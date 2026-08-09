import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

/**
 * The audit trail, per Phase 03 and docs/concerns/01-fairness-anticheat.md.
 *
 * Two destinations, deliberately different:
 *
 *   stdout   every message, accepted or rejected, as one-line JSON. Render
 *            captures it, so an attack can be tailed live while reproducing it.
 *   database rejections ONLY. A slow-burn pattern of abuse has to survive log
 *            rotation, and Render's free tier retains logs for days, not months.
 *
 * Accepted messages stay out of the table on purpose. One row per dial change
 * per match is reasonable; one per tick is not, and an audit trail nobody can
 * afford to read is not an audit trail.
 */

/** Attacker-controlled, so it is bounded before it is stored or logged. */
const MAX_PAYLOAD_CHARS = 500;

export type AuditEvent = {
  room: string;
  userId?: string | null;
  username?: string | null;
  type: string;
  accepted: boolean;
  reason?: string;
  payload?: unknown;
  tick?: number;
};

function safePayload(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (text === undefined) return undefined;
    return text.length > MAX_PAYLOAD_CHARS
      ? `${text.slice(0, MAX_PAYLOAD_CHARS)}…[truncated]`
      : text;
  } catch {
    // Circular, a BigInt, a hostile toJSON — the fact that it could not be
    // serialised is itself worth recording.
    return "[unserialisable]";
  }
}

export function audit(event: AuditEvent): void {
  const line = {
    evt: "match.msg",
    at: new Date().toISOString(),
    room: event.room,
    user: event.userId ?? null,
    name: event.username ?? null,
    type: event.type,
    ok: event.accepted,
    ...(event.reason ? { reason: event.reason } : {}),
    ...(event.tick !== undefined ? { tick: event.tick } : {}),
    ...(event.accepted ? {} : { payload: safePayload(event.payload) }),
  };

  // One line, machine-parseable. Rejections go to stderr so they can be
  // filtered from ordinary traffic without a query.
  const text = JSON.stringify(line);
  if (event.accepted) console.log(text);
  else console.warn(text);

  if (!event.accepted) void persistRejection(event);
}

async function persistRejection(event: AuditEvent): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;

  try {
    const sql = neon(url);
    await sql`
      insert into match_audit (id, room_id, user_id, message_type, reason, payload, at)
      values (
        ${randomUUID()}, ${event.room}, ${event.userId ?? null},
        ${event.type}, ${event.reason ?? "rejected"},
        ${safePayload(event.payload) ?? null}, now()
      )
    `;
  } catch (error) {
    // Never let auditing take down the room. The stdout line has already been
    // written, so the event is not lost even when the database is unreachable.
    console.error(
      JSON.stringify({ evt: "match.audit.failed", error: String(error) }),
    );
  }
}

/**
 * Counts rejections per user in a sliding window so repeated abuse can escalate.
 *
 * Rejections are cheap at first — a version-skewed client should bounce, not be
 * kicked. Past a threshold it is told it is being throttled; past a harder one
 * it is disconnected. The match itself is never affected either way: their last
 * dials stand, exactly as for an ordinary disconnect.
 */
export class AbuseTracker {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly windowMs = 10_000,
    private readonly warnAt = 6,
    private readonly kickAt = 16,
  ) {}

  record(userId: string): "ok" | "warn" | "kick" {
    const now = Date.now();
    const recent = (this.hits.get(userId) ?? []).filter(
      (t) => now - t < this.windowMs,
    );
    recent.push(now);
    this.hits.set(userId, recent);

    if (recent.length >= this.kickAt) return "kick";
    if (recent.length >= this.warnAt) return "warn";
    return "ok";
  }

  forget(userId: string): void {
    this.hits.delete(userId);
  }
}
