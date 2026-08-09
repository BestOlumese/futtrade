import { randomUUID } from "node:crypto";
import { Room, ServerError, type Client } from "colyseus";
import { Schema, MapSchema, type } from "@colyseus/schema";
import { spendTicket, verifyTicket } from "../match-ticket.js";
import { AbuseTracker, audit } from "../audit.js";
import {
  DEFAULT_DIALS,
  isMentality,
  isPressing,
  type Dials,
} from "../sim/dials.js";
import {
  makeRng,
  newMatch,
  simulateTick,
  SIM_MINUTES_PER_TICK,
  TICKS_PER_MATCH,
  type MatchSimState,
} from "../sim/match-sim.js";
import type { MatchEvent } from "../sim/events.js";
import {
  abandonMatch,
  completeMatch,
  insertEvents,
  openMatch,
} from "../db.js";

/**
 * Phases 01–04 — the authoritative match room.
 *
 * Phase 01 proved the tick loop; Phase 02 added the simulation and two tactical
 * dials; Phase 04 captures and persists the event stream. Substitutions,
 * formations and attributes are later phases and must not creep in here.
 *
 * Server authority, per docs/concerns/01-fairness-anticheat.md, is the whole
 * defence. Clients send INTENT — "I want attacking" — and never outcomes. The
 * score, the clock, the possession and the change budget are all computed and
 * enforced here. A modified client can lie about what it wants; it cannot lie
 * about what happened.
 *
 * From docs/concerns/02-realtime-sync-reconnection.md: the clock is server
 * time; a disconnected manager does not pause the match, their last dials
 * simply stand; and the room survives being briefly empty.
 */

const TICK_MS = 3_000;
const GRACE_MS = 60_000;
const MAX_PLAYERS = 2;

/** Feature spec: 3–4 tactical changes per half, counted server-side. */
const CHANGES_PER_HALF = 3;
/** Rate limit, independent of the budget — a burst is rejected even if unspent. */
const MIN_MS_BETWEEN_CHANGES = 1_500;
const HALF_TIME_TICK = TICKS_PER_MATCH / 2;

/**
 * Phase 04: how often the event buffer reaches Postgres.
 *
 * Six batched inserts a match instead of ~370 round trips. The trade is that a
 * process restart loses at most five ticks of in-flight events; writing once at
 * full time would lose the whole match, and writing every tick would put Neon in
 * the hot path of a three-second loop for no real gain.
 */
const FLUSH_EVERY_TICKS = 5;

export type Phase = "lobby" | "live" | "fulltime";

export class PlayerSlot extends Schema {
  @type("string") userId = "";
  @type("string") username = "";
  @type("boolean") connected = true;
  @type("number") joinedAtTick = 0;
  @type("string") side = "home";

  @type("string") mentality = DEFAULT_DIALS.mentality;
  @type("string") pressing = DEFAULT_DIALS.pressing;
  /** Changes spent in the current half. Display mirrors it; this enforces it. */
  @type("number") changesUsed = 0;
}

export class SideScore extends Schema {
  @type("number") goals = 0;
  @type("number") shots = 0;
  // float64 explicitly: Colyseus's default number encoding is float32, which
  // cannot represent 1.8 and sends 1.7999999523 instead.
  @type("float64") xg = 0;
  @type("number") possession = 50;
}

export class MatchState extends Schema {
  @type("string") phase: Phase = "lobby";
  @type("number") tick = 0;
  @type("number") tickAt = 0;
  /** Simulated minutes elapsed — what the UI shows as the match clock. */
  @type("number") minute = 0;
  @type("number") half = 1;

  @type(SideScore) home = new SideScore();
  @type(SideScore) away = new SideScore();

  @type({ map: PlayerSlot }) players = new MapSchema<PlayerSlot>();
}

type JoinOptions = { ticket?: string };
type AuthContext = { userId: string; username: string };

export class MatchRoom extends Room<MatchState> {
  maxClients = MAX_PLAYERS;
  autoDispose = false;

  private disposeTimer?: NodeJS.Timeout;
  private seed = (Math.random() * 2 ** 32) >>> 0;
  private sim: MatchSimState = newMatch(this.seed);
  private rng = makeRng(this.seed);
  private lastChangeAt = new Map<string, number>();
  private persisted = false;
  private abuse = new AbuseTracker();

  /* ── Phase 04: the event stream ─────────────────────────────────────────── */

  /** Set at kickoff, not at full time — events need a row to point at. */
  private matchId: string | null = null;
  /** Resolves to whether the match row actually landed. */
  private opening: Promise<boolean> = Promise.resolve(false);
  /** Events produced since the last flush. */
  private pending: MatchEvent[] = [];
  /**
   * Flushes are serialised through this chain. Ticks fire every three seconds
   * and a flush is a network round trip, so two could otherwise overlap and
   * reach the database out of order.
   */
  private flushing: Promise<void> = Promise.resolve();

  static async onAuth(token: string, options: JoinOptions): Promise<AuthContext> {
    const ticket = options?.ticket ?? token;
    if (!ticket) throw new ServerError(401, "Sign in to join a match.");
    try {
      const claims = await verifyTicket(ticket);
      // Single use. A captured ticket is otherwise replayable for its whole
      // 60-second life, which would let someone take a seat beside the manager
      // whose session minted it.
      if (!spendTicket(claims.jti)) {
        console.warn("[match] rejected join: ticket already used");
        throw new ServerError(401, "That sign-in link was already used.");
      }
      return { userId: claims.userId, username: claims.username || "Manager" };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn("[match] rejected join:", reason);
      if (reason.startsWith("NOT_CONFIGURED")) {
        throw new ServerError(503, "The match server is missing MATCH_TICKET_SECRET.");
      }
      throw new ServerError(401, "That sign-in couldn't be verified.");
    }
  }

  onCreate() {
    this.state = new MatchState();
    this.hardenMessageDispatch();

    this.onMessage("kickoff", (client) => this.handleKickoff(client));
    this.onMessage("rematch", (client) => this.handleRematch(client));
    this.onMessage("dials", (client, message: unknown) =>
      this.handleDials(client, message),
    );

    /**
     * Anything else. Colyseus silently drops unhandled types, which is safe but
     * invisible — a client probing for a `setScore` handler would get no
     * response and leave no trace. Phase 03 requires attempts to be logged, so
     * every unknown type is refused loudly and recorded.
     *
     * There is deliberately no handler that accepts an outcome. Clients send
     * intent; the room decides what happened.
     */
    this.onMessage("*", (client, type, message: unknown) => {
      this.refuse(
        client,
        String(type),
        "Unknown message type. Clients send intent, never outcomes.",
        message,
      );
    });

    console.log(`[match] room ${this.roomId} created`);
  }

  /**
   * Closes a denial-of-service hole in Colyseus 0.16's message dispatch.
   *
   * Handlers are stored in a PLAIN object, so a message whose type is
   * `__proto__` resolves to `Object.prototype` — truthy, so the "*" catch-all
   * is skipped — and dispatch then calls `.callback(...)` on it, which is
   * undefined. The resulting TypeError is uncaught inside the websocket
   * receiver and takes the whole process down, ending every live match on the
   * server. `constructor`, `toString`, `valueOf` and any other Object.prototype
   * key do the same.
   *
   * Any authenticated client could do this with one message. Found by
   * src/attack.ts, which is the entire reason that script exists.
   *
   * The fix is to give the registry a null prototype, so those keys resolve to
   * undefined and fall through to the catch-all like any other unknown type.
   * Existing internal handlers are carried over rather than dropped.
   */
  private hardenMessageDispatch() {
    const registry = this as unknown as {
      onMessageHandlers: Record<string, unknown>;
    };
    const safe = Object.create(null) as Record<string, unknown>;
    Object.assign(safe, registry.onMessageHandlers);
    registry.onMessageHandlers = safe;

    // Defence in depth: a throw inside any handler is contained and audited
    // rather than escaping into the transport.
    this.onUncaughtException = (error, methodName) => {
      audit({
        room: this.roomId,
        type: `exception:${methodName}`,
        accepted: false,
        reason: String(error).slice(0, 200),
        tick: this.state?.tick,
      });
    };
  }

  /* ── Dials ────────────────────────────────────────────────────────────── */

  /**
   * Records a refusal, tells the client why, and escalates on repetition.
   * Escalation never touches the match — a kicked client's last dials stand,
   * exactly as for an ordinary disconnect.
   */
  private refuse(client: Client, type: string, reason: string, payload?: unknown) {
    const slot = this.slotFor(client);
    audit({
      room: this.roomId,
      userId: slot?.userId ?? null,
      username: slot?.username ?? null,
      type,
      accepted: false,
      reason,
      payload,
      tick: this.state.tick,
    });

    client.send("rejected", { type, reason });

    const key = slot?.userId ?? client.sessionId;
    const level = this.abuse.record(key);
    if (level === "warn") {
      client.send("warning", {
        reason: "Too many refused messages. Slow down.",
      });
    } else if (level === "kick") {
      audit({
        room: this.roomId,
        userId: slot?.userId ?? null,
        username: slot?.username ?? null,
        type: "abuse",
        accepted: false,
        reason: "Disconnected after repeated refused messages.",
        tick: this.state.tick,
      });
      client.leave(4001, "Too many refused messages.");
    }
  }

  private slotFor(client: Client): PlayerSlot | undefined {
    const userId = (client.userData as { userId?: string } | undefined)?.userId;
    return userId ? this.state.players.get(userId) : undefined;
  }

  /**
   * A dial change is INTENT. It is validated, budgeted and rate-limited here;
   * nothing the client sends is trusted beyond "which setting do you want".
   */
  private handleDials(client: Client, message: unknown) {
    const slot = this.slotFor(client);
    if (!slot) return;

    const body = message as { mentality?: unknown; pressing?: unknown } | null;
    const mentality = String(body?.mentality ?? "");
    const pressing = String(body?.pressing ?? "");

    if (!isMentality(mentality) || !isPressing(pressing)) {
      this.refuse(client, "dials", "Unknown dial setting.", message);
      return;
    }

    // Before kickoff the opening setup is free — it isn't a change yet.
    if (this.state.phase === "lobby") {
      slot.mentality = mentality;
      slot.pressing = pressing;
      return;
    }

    if (this.state.phase !== "live") {
      this.refuse(client, "dials", "The match has finished.", message);
      return;
    }

    if (mentality === slot.mentality && pressing === slot.pressing) return;

    const now = Date.now();
    const last = this.lastChangeAt.get(slot.userId) ?? 0;
    if (now - last < MIN_MS_BETWEEN_CHANGES) {
      // Rate limit is separate from the budget: a client spamming the socket is
      // rejected here even when it has changes left. Logged, per the fairness doc.
      this.refuse(client, "dials", "Rate limited: too quickly.", message);
      return;
    }

    if (slot.changesUsed >= CHANGES_PER_HALF) {
      this.refuse(
        client,
        "dials",
        `No changes left this half (${CHANGES_PER_HALF} per half).`,
        message,
      );
      return;
    }

    slot.mentality = mentality;
    slot.pressing = pressing;
    slot.changesUsed += 1;
    this.lastChangeAt.set(slot.userId, now);

    audit({
      room: this.roomId, userId: slot.userId, username: slot.username,
      type: "dials", accepted: true,
      reason: `${mentality}/${pressing} (${slot.changesUsed}/${CHANGES_PER_HALF})`,
      tick: this.state.tick,
    });
  }

  private dialsFor(side: "home" | "away"): Dials {
    for (const slot of this.state.players.values()) {
      if (slot.side === side) {
        return {
          mentality: slot.mentality as Dials["mentality"],
          pressing: slot.pressing as Dials["pressing"],
        };
      }
    }
    // An unfilled slot plays fixed defaults and never adapts. This is not an AI
    // opponent — that is Phase 08 — it just lets a manager test alone.
    return DEFAULT_DIALS;
  }

  /* ── Match lifecycle ──────────────────────────────────────────────────── */

  private handleKickoff(client: Client) {
    if (this.state.phase !== "lobby") return;
    if (!this.slotFor(client)) return;
    if (this.state.players.size === 0) return;

    // The match row is opened HERE rather than at full time, because the event
    // stream flushes while the match is still being played and its rows need a
    // match to point at. Deliberately not awaited: the first flush is fifteen
    // seconds away and kickoff must not wait on a network round trip.
    this.matchId = randomUUID();
    this.opening = this.openRecord(this.matchId);

    this.state.phase = "live";
    this.state.tickAt = Date.now();
    this.setSimulationInterval(() => this.advance(), TICK_MS);
    console.log(`[match] room ${this.roomId} kicked off as match ${this.matchId}`);
  }

  private async openRecord(matchId: string): Promise<boolean> {
    const home = this.sideSlot("home");
    const away = this.sideSlot("away");
    try {
      return await openMatch({
        matchId,
        roomId: this.roomId,
        homeUserId: home?.userId ?? null,
        awayUserId: away?.userId ?? null,
        homeMentality: home?.mentality ?? DEFAULT_DIALS.mentality,
        homePressing: home?.pressing ?? DEFAULT_DIALS.pressing,
        awayMentality: away?.mentality ?? DEFAULT_DIALS.mentality,
        awayPressing: away?.pressing ?? DEFAULT_DIALS.pressing,
      });
    } catch (error) {
      // The match still plays. It simply won't be recorded, and that is said
      // out loud rather than discovered later as a missing row.
      console.error("[match] could not open the match record:", error);
      return false;
    }
  }

  private handleRematch(client: Client) {
    if (this.state.phase !== "fulltime") return;
    if (!this.slotFor(client)) return;

    // A rematch is a NEW match, not a reset of the old one: its own id, its own
    // event log, its own row. The previous one is already finished and closed.
    this.seed = (Math.random() * 2 ** 32) >>> 0;
    this.sim = newMatch(this.seed);
    this.rng = makeRng(this.seed);
    this.persisted = false;
    this.matchId = null;
    this.pending = [];
    this.lastChangeAt.clear();

    this.state.phase = "lobby";
    this.state.tick = 0;
    this.state.minute = 0;
    this.state.half = 1;
    this.applyScore();
    for (const slot of this.state.players.values()) slot.changesUsed = 0;

    console.log(`[match] room ${this.roomId} reset for a rematch`);
  }

  private applyScore() {
    const played = Math.max(this.sim.tick, 1);
    this.state.home.goals = this.sim.home.goals;
    this.state.home.shots = this.sim.home.shots;
    this.state.home.xg = Math.round(this.sim.home.xg * 100) / 100;
    this.state.home.possession = Math.round(
      (this.sim.home.possessionTicks / played) * 100,
    );
    this.state.away.goals = this.sim.away.goals;
    this.state.away.shots = this.sim.away.shots;
    this.state.away.xg = Math.round(this.sim.away.xg * 100) / 100;
    this.state.away.possession = 100 - this.state.home.possession;
  }

  private advance() {
    if (this.state.phase !== "live") return;

    // The events this tick produced, in order. Phase 04: these are the spine of
    // the system, so they are captured at the moment the sim decides them, not
    // reconstructed afterwards from the aggregates.
    const produced: MatchEvent[] = [];
    simulateTick(
      this.sim,
      this.dialsFor("home"),
      this.dialsFor("away"),
      this.rng,
      produced,
    );

    this.state.tick = this.sim.tick;
    this.state.minute = this.sim.tick * SIM_MINUTES_PER_TICK;
    this.state.tickAt = Date.now();
    this.applyScore();

    if (produced.length > 0) {
      this.pending.push(...produced);
      // Broadcast, not replicated state: the ticker and the 2D viewer want a
      // live feed, but three hundred events do not belong in a schema that is
      // diffed every tick and re-sent in full to a reconnecting client.
      // See docs/concerns/08-mobile-performance.md.
      this.broadcast("events", produced);
    }

    // Half time refreshes the change budget, which is what makes it a budget
    // per half rather than per match.
    if (this.state.half === 1 && this.sim.tick >= HALF_TIME_TICK) {
      this.state.half = 2;
      for (const slot of this.state.players.values()) slot.changesUsed = 0;
    }

    if (this.sim.tick % FLUSH_EVERY_TICKS === 0) this.scheduleFlush();

    if (this.sim.tick >= TICKS_PER_MATCH) this.endMatch();
  }

  private sideSlot(side: "home" | "away"): PlayerSlot | undefined {
    for (const slot of this.state.players.values()) {
      if (slot.side === side) return slot;
    }
    return undefined;
  }

  /**
   * Drains the buffer into Postgres in one batched statement.
   *
   * Serialised through `this.flushing` so two flushes cannot overlap — ticks
   * fire every three seconds and a round trip can outlast that, and events
   * arriving out of order would leave the `seq` column looking gapped when it
   * is merely late.
   */
  private scheduleFlush(): Promise<void> {
    this.flushing = this.flushing.then(() => this.flushNow());
    return this.flushing;
  }

  private async flushNow(): Promise<void> {
    if (this.pending.length === 0) return;
    const matchId = this.matchId;
    if (!matchId) return;

    if (!(await this.opening)) {
      // No match row, so there is nothing for these to reference. Drop them
      // rather than retrying forever, and say so.
      console.warn(
        `[match] ${this.pending.length} events discarded: match ${matchId} was never opened`,
      );
      this.pending = [];
      return;
    }

    const batch = this.pending;
    this.pending = [];

    // One retry. `(match_id, seq)` is unique, so a retry after a write that
    // actually succeeded fails on the index instead of duplicating the log —
    // which is precisely why retrying here is safe.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await insertEvents(matchId, batch);
        return;
      } catch (error) {
        if (attempt === 2) {
          // Loud, and detectable afterwards: the missing rows show up as a gap
          // in `seq`, which is what `events:verify` checks for.
          console.error(
            `[match] failed to persist ${batch.length} events (seq ${batch[0].seq}–${batch[batch.length - 1].seq}):`,
            error,
          );
          return;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  private endMatch() {
    this.state.phase = "fulltime";
    this.setSimulationInterval(undefined);
    console.log(
      `[match] full time in ${this.roomId}: ${this.state.home.goals}-${this.state.away.goals}`,
    );
    void this.persist();
  }

  private async persist() {
    if (this.persisted) return;
    this.persisted = true;

    // The tail of the event log first, so the match is never marked finished
    // while some of its events are still only in memory.
    await this.scheduleFlush();

    const matchId = this.matchId;
    if (!matchId || !(await this.opening)) return;

    const home = this.sideSlot("home");
    const away = this.sideSlot("away");

    try {
      await completeMatch({
        matchId,
        homeScore: this.state.home.goals,
        awayScore: this.state.away.goals,
        homePossession: this.state.home.possession,
        homeShots: this.state.home.shots,
        awayShots: this.state.away.shots,
        // The sim's own totals, not the two-decimal ones the UI displays: this
        // column is the checksum the event log is verified against, so it wants
        // the number the sim actually accumulated.
        homeXg: this.sim.home.xg,
        awayXg: this.sim.away.xg,
        homeMentality: home?.mentality ?? DEFAULT_DIALS.mentality,
        homePressing: home?.pressing ?? DEFAULT_DIALS.pressing,
        awayMentality: away?.mentality ?? DEFAULT_DIALS.mentality,
        awayPressing: away?.pressing ?? DEFAULT_DIALS.pressing,
      });
    } catch (error) {
      // A failed write must not take the room down — the managers still get
      // their result, and the failure is loud rather than silent.
      console.error("[match] failed to complete the match record:", error);
    }
  }

  /* ── Membership ───────────────────────────────────────────────────────── */

  async onJoin(client: Client, _options: JoinOptions, auth: AuthContext) {
    const existing = this.state.players.get(auth.userId);
    if (existing) {
      existing.connected = true;
      client.userData = { userId: auth.userId };
      console.log(`[match] ${auth.username} resumed at tick ${this.state.tick}`);
      return;
    }

    if (this.state.players.size >= MAX_PLAYERS) {
      throw new ServerError(403, "This match already has two managers.");
    }

    const takenHome = [...this.state.players.values()].some((p) => p.side === "home");

    const slot = new PlayerSlot();
    slot.userId = auth.userId;
    slot.username = auth.username;
    slot.connected = true;
    slot.joinedAtTick = this.state.tick;
    slot.side = takenHome ? "away" : "home";
    this.state.players.set(auth.userId, slot);

    client.userData = { userId: auth.userId };
    this.cancelDisposal();
    console.log(`[match] ${auth.username} joined as ${slot.side} at tick ${this.state.tick}`);
  }

  async onLeave(client: Client, consented: boolean) {
    const slot = this.slotFor(client);

    if (!slot) {
      this.scheduleDisposalIfEmpty();
      return;
    }

    slot.connected = false;

    if (consented) {
      this.abuse.forget(slot.userId);
      console.log(`[match] ${slot.username} left deliberately at tick ${this.state.tick}`);
      this.state.players.delete(slot.userId);
      this.scheduleDisposalIfEmpty();
      return;
    }

    console.log(
      `[match] ${slot.username} dropped at tick ${this.state.tick}; their dials stand`,
    );

    try {
      await this.allowReconnection(client, GRACE_MS / 1000);
      slot.connected = true;
      console.log(`[match] ${slot.username} reconnected at tick ${this.state.tick}`);
    } catch {
      this.state.players.delete(slot.userId);
      console.log(`[match] ${slot.username} did not return within the grace period`);
      this.scheduleDisposalIfEmpty();
    }
  }

  private scheduleDisposalIfEmpty() {
    if (this.state.players.size > 0 || this.disposeTimer) return;
    this.disposeTimer = setTimeout(() => {
      if (this.state.players.size === 0) {
        console.log(`[match] room ${this.roomId} empty for the grace period, disposing`);
        void this.disconnect();
      }
    }, GRACE_MS);
  }

  private cancelDisposal() {
    if (!this.disposeTimer) return;
    clearTimeout(this.disposeTimer);
    this.disposeTimer = undefined;
  }

  onDispose() {
    this.cancelDisposal();
    console.log(`[match] room ${this.roomId} disposed at tick ${this.state.tick}`);

    // A room that died mid-match leaves a row still claiming to be live. Sweep
    // it, so an abandoned match is visibly abandoned rather than indistinguishable
    // from one that is still being played. Best effort by nature — if the
    // process is being killed this may not land, which is exactly why the row
    // is written at kickoff and not relied upon to be tidied at the end.
    if (this.state.phase === "live" && this.matchId) {
      const matchId = this.matchId;
      void this.scheduleFlush()
        .then(() => abandonMatch(matchId))
        .catch((error) =>
          console.error("[match] could not mark the match abandoned:", error),
        );
    }
  }
}
