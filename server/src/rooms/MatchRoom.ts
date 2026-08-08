import { Room, ServerError, type Client } from "colyseus";
import { Schema, MapSchema, type } from "@colyseus/schema";
import { verifyTicket } from "../match-ticket.js";

/**
 * Phase 01 — the authoritative tick loop. No football in it.
 *
 * What this proves, and only this: the server owns the clock, both clients see
 * the same ticked state, and a client that drops can rejoin and resync.
 * Simulation is Phase 02; tactical input is Phase 12. Nothing here should grow
 * into those — they get their own phases so the loop can be trusted first.
 *
 * Decisions this encodes, from docs/concerns/02-realtime-sync-reconnection.md:
 *
 *   - The clock is server time, always. Clients display `tick`; they never
 *     advance it themselves, because a client that runs its own clock drifts.
 *   - A disconnected manager does NOT pause the match. Play continues on their
 *     last-known instructions and they have GRACE_MS to rejoin. Pausing would
 *     hand a losing player a freeze button.
 *   - The room survives being briefly empty for the same window, so both
 *     managers reloading at once doesn't destroy the match.
 */

const TICK_MS = 3_000;
const GRACE_MS = 60_000;
const MAX_PLAYERS = 2;

export class PlayerSlot extends Schema {
  @type("string") userId = "";
  @type("string") username = "";
  /** False while they're inside the grace window rather than gone. */
  @type("boolean") connected = true;
  /** Server tick at which they joined — proof a rejoin resynced, not restarted. */
  @type("number") joinedAtTick = 0;
}

export class MatchState extends Schema {
  /** The authoritative clock. Everything downstream reads this, never its own. */
  @type("number") tick = 0;
  /** Server wall time of the last tick, so clients can show drift honestly. */
  @type("number") tickAt = 0;
  @type({ map: PlayerSlot }) players = new MapSchema<PlayerSlot>();
}

type JoinOptions = { ticket?: string };
type AuthContext = { userId: string; username: string };

export class MatchRoom extends Room<MatchState> {
  maxClients = MAX_PLAYERS;
  /** Disposal is handled explicitly, so an empty room can keep ticking. */
  autoDispose = false;

  private disposeTimer?: NodeJS.Timeout;

  /**
   * Identity is established before a seat is granted. The ticket is minted by
   * the app from a real Better Auth session and lives ~60s.
   */
  static async onAuth(token: string, options: JoinOptions): Promise<AuthContext> {
    const ticket = options?.ticket ?? token;
    if (!ticket) {
      throw new ServerError(401, "Sign in to join a match.");
    }
    try {
      const claims = await verifyTicket(ticket);
      return { userId: claims.userId, username: claims.username || "Manager" };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn("[match] rejected join:", reason);
      throw new ServerError(401, "That sign-in couldn't be verified.");
    }
  }

  onCreate() {
    this.state = new MatchState();

    // Colyseus's own interval, so the tick is tied to the room's lifecycle and
    // stops cleanly on disposal rather than leaking a timer.
    this.setSimulationInterval(() => this.advance(), TICK_MS);

    this.onMessage("ping", (client) => {
      client.send("pong", { tick: this.state.tick, serverTime: Date.now() });
    });

    console.log(`[match] room ${this.roomId} created`);
  }

  private advance() {
    this.state.tick += 1;
    this.state.tickAt = Date.now();
  }

  async onJoin(client: Client, _options: JoinOptions, auth: AuthContext) {
    // Same person returning to a slot they already hold — a reload rather than
    // a second player.
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

    const slot = new PlayerSlot();
    slot.userId = auth.userId;
    slot.username = auth.username;
    slot.connected = true;
    slot.joinedAtTick = this.state.tick;
    this.state.players.set(auth.userId, slot);

    client.userData = { userId: auth.userId };
    this.cancelDisposal();
    console.log(`[match] ${auth.username} joined at tick ${this.state.tick}`);
  }

  async onLeave(client: Client, consented: boolean) {
    const userId = (client.userData as { userId?: string } | undefined)?.userId;
    const slot = userId ? this.state.players.get(userId) : undefined;

    if (!slot) {
      console.warn(`[match] leave from a client with no slot (consented=${consented})`);
      this.scheduleDisposalIfEmpty();
      return;
    }

    // Marked absent, not removed: the match carries on without them, and the
    // slot is held so a rejoin resumes rather than starts over.
    slot.connected = false;

    if (consented) {
      // A deliberate leave gives up the slot immediately — no grace period,
      // because they chose to go.
      console.log(`[match] ${slot.username} left deliberately at tick ${this.state.tick}`);
      this.state.players.delete(slot.userId);
      this.scheduleDisposalIfEmpty();
      return;
    }

    console.log(
      `[match] ${slot.username} dropped at tick ${this.state.tick}, holding their slot for ${GRACE_MS / 1000}s`,
    );

    try {
      // Resolves if they come back inside the window.
      await this.allowReconnection(client, GRACE_MS / 1000);
      slot.connected = true;
      console.log(`[match] ${slot.username} reconnected at tick ${this.state.tick}`);
    } catch {
      this.state.players.delete(slot.userId);
      console.log(`[match] ${slot.username} did not return within the grace period`);
      this.scheduleDisposalIfEmpty();
    }
  }

  /**
   * An empty room keeps ticking for the grace period. Both managers reloading
   * at the same moment is a normal thing to happen and shouldn't end a match.
   */
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
