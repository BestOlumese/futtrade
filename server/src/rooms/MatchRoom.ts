import { Room, ServerError, type Client } from "colyseus";
import { Schema, MapSchema, type } from "@colyseus/schema";
import { verifyTicket } from "../match-ticket.js";
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
import { saveMatchResult } from "../db.js";

/**
 * Phases 01–02 — the authoritative match room.
 *
 * Phase 01 proved the tick loop; Phase 02 adds the simulation and two tactical
 * dials. Substitutions, formations and attributes are later phases and must not
 * creep in here.
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
  private sim: MatchSimState = newMatch();
  private rng = makeRng((Math.random() * 2 ** 32) >>> 0);
  private lastChangeAt = new Map<string, number>();
  private persisted = false;

  static async onAuth(token: string, options: JoinOptions): Promise<AuthContext> {
    const ticket = options?.ticket ?? token;
    if (!ticket) throw new ServerError(401, "Sign in to join a match.");
    try {
      const claims = await verifyTicket(ticket);
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

    this.onMessage("kickoff", (client) => this.handleKickoff(client));
    this.onMessage("rematch", (client) => this.handleRematch(client));
    this.onMessage("dials", (client, message: unknown) =>
      this.handleDials(client, message),
    );

    console.log(`[match] room ${this.roomId} created`);
  }

  /* ── Dials ────────────────────────────────────────────────────────────── */

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
      client.send("dialsRejected", { reason: "Unknown dial setting." });
      return;
    }

    // Before kickoff the opening setup is free — it isn't a change yet.
    if (this.state.phase === "lobby") {
      slot.mentality = mentality;
      slot.pressing = pressing;
      return;
    }

    if (this.state.phase !== "live") {
      client.send("dialsRejected", { reason: "The match has finished." });
      return;
    }

    if (mentality === slot.mentality && pressing === slot.pressing) return;

    const now = Date.now();
    const last = this.lastChangeAt.get(slot.userId) ?? 0;
    if (now - last < MIN_MS_BETWEEN_CHANGES) {
      // Rate limit is separate from the budget: a client spamming the socket is
      // rejected here even when it has changes left. Logged, per the fairness doc.
      console.warn(`[match] rate-limited dial change from ${slot.username}`);
      client.send("dialsRejected", { reason: "Too quickly. Wait a moment." });
      return;
    }

    if (slot.changesUsed >= CHANGES_PER_HALF) {
      client.send("dialsRejected", {
        reason: `No changes left this half (${CHANGES_PER_HALF} per half).`,
      });
      return;
    }

    slot.mentality = mentality;
    slot.pressing = pressing;
    slot.changesUsed += 1;
    this.lastChangeAt.set(slot.userId, now);
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

    this.state.phase = "live";
    this.state.tickAt = Date.now();
    this.setSimulationInterval(() => this.advance(), TICK_MS);
    console.log(`[match] room ${this.roomId} kicked off`);
  }

  private handleRematch(client: Client) {
    if (this.state.phase !== "fulltime") return;
    if (!this.slotFor(client)) return;

    this.sim = newMatch();
    this.rng = makeRng((Math.random() * 2 ** 32) >>> 0);
    this.persisted = false;
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

    simulateTick(this.sim, this.dialsFor("home"), this.dialsFor("away"), this.rng);

    this.state.tick = this.sim.tick;
    this.state.minute = this.sim.tick * SIM_MINUTES_PER_TICK;
    this.state.tickAt = Date.now();
    this.applyScore();

    // Half time refreshes the change budget, which is what makes it a budget
    // per half rather than per match.
    if (this.state.half === 1 && this.sim.tick >= HALF_TIME_TICK) {
      this.state.half = 2;
      for (const slot of this.state.players.values()) slot.changesUsed = 0;
    }

    if (this.sim.tick >= TICKS_PER_MATCH) this.endMatch();
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

    const bySide = (side: "home" | "away") => {
      for (const slot of this.state.players.values()) {
        if (slot.side === side) return slot;
      }
      return undefined;
    };
    const home = bySide("home");
    const away = bySide("away");

    try {
      await saveMatchResult({
        roomId: this.roomId,
        homeUserId: home?.userId ?? null,
        awayUserId: away?.userId ?? null,
        homeScore: this.state.home.goals,
        awayScore: this.state.away.goals,
        homePossession: this.state.home.possession,
        homeShots: this.state.home.shots,
        awayShots: this.state.away.shots,
        homeXg: this.state.home.xg,
        awayXg: this.state.away.xg,
        homeMentality: home?.mentality ?? DEFAULT_DIALS.mentality,
        homePressing: home?.pressing ?? DEFAULT_DIALS.pressing,
        awayMentality: away?.mentality ?? DEFAULT_DIALS.mentality,
        awayPressing: away?.pressing ?? DEFAULT_DIALS.pressing,
      });
    } catch (error) {
      // A failed write must not take the room down — the managers still get
      // their result, and the failure is loud rather than silent.
      console.error("[match] failed to persist result:", error);
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
  }
}
