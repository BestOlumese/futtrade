import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { MatchEvent } from "./sim/events.js";

/**
 * The match server's own write path to Neon.
 *
 * Giving the match server database access is deliberate. Phase 04 persists the
 * event stream, which AGENTS.md calls the spine of the system, and that stream
 * is produced here — routing it back through the Next.js app would add a
 * network hop and a second failure mode to the most write-heavy path in the
 * product. It writes results; it never reads user data.
 *
 * Raw SQL over the HTTP driver rather than Drizzle: the schema is defined once
 * in the app's lib/db/schema.ts, and two Drizzle schema definitions across two
 * packages would be a second source of truth waiting to drift.
 */

export type MatchOpening = {
  matchId: string;
  roomId: string;
  homeUserId: string | null;
  awayUserId: string | null;
  homeMentality: string;
  homePressing: string;
  awayMentality: string;
  awayPressing: string;
};

export type MatchClosing = {
  matchId: string;
  homeScore: number;
  awayScore: number;
  homePossession: number;
  homeShots: number;
  awayShots: number;
  homeXg: number;
  awayXg: number;
  homeMentality: string;
  homePressing: string;
  awayMentality: string;
  awayPressing: string;
};

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Loud, not silent. A match that vanishes without a word is worse than one
    // that fails — the managers would never know it wasn't recorded.
    console.warn(
      "[match] DATABASE_URL is not set on the match server; nothing will be persisted",
    );
    return null;
  }
  return neon(url);
}

/**
 * Opens the match record AT KICKOFF, not at full time.
 *
 * The event stream is keyed by match id and flushes while the match is still
 * being played, so the row has to exist first — and a match that dies in the
 * 60th minute is then a row you can find rather than silence.
 */
export async function openMatch(row: MatchOpening): Promise<boolean> {
  const sql = connect();
  if (!sql) return false;

  await sql`
    insert into "match" (
      id, room_id, home_user_id, away_user_id, status,
      home_mentality, home_pressing, away_mentality, away_pressing,
      started_at
    ) values (
      ${row.matchId}, ${row.roomId}, ${row.homeUserId}, ${row.awayUserId}, 'live',
      ${row.homeMentality}, ${row.homePressing},
      ${row.awayMentality}, ${row.awayPressing},
      now()
    )
  `;
  return true;
}

export async function completeMatch(row: MatchClosing): Promise<void> {
  const sql = connect();
  if (!sql) return;

  await sql`
    update "match" set
      status = 'finished',
      home_score = ${row.homeScore}, away_score = ${row.awayScore},
      home_shots = ${row.homeShots}, away_shots = ${row.awayShots},
      home_xg = ${row.homeXg}, away_xg = ${row.awayXg},
      home_possession = ${row.homePossession},
      home_mentality = ${row.homeMentality}, home_pressing = ${row.homePressing},
      away_mentality = ${row.awayMentality}, away_pressing = ${row.awayPressing},
      finished_at = now()
    where id = ${row.matchId}
  `;
}

/** A room that died mid-match. The row stays; it stops claiming to be live. */
export async function abandonMatch(matchId: string): Promise<void> {
  const sql = connect();
  if (!sql) return;

  await sql`
    update "match" set status = 'abandoned', finished_at = now()
    where id = ${matchId} and status = 'live'
  `;
}

/**
 * Writes a batch of events in ONE statement.
 *
 * `unnest` over parallel arrays rather than a generated VALUES list: the
 * statement text is fixed regardless of batch size, so a 60-event flush is a
 * single round trip with thirteen parameters instead of eight hundred. The
 * phase spec explicitly warns against a per-event round trip, and this is the
 * cheap way to honour it.
 *
 * `(match_id, seq)` is uniquely indexed, so a retried flush cannot silently
 * duplicate the log — it fails, loudly, which is the behaviour you want from
 * the spine of the system.
 */
export async function insertEvents(
  matchId: string,
  events: MatchEvent[],
): Promise<void> {
  if (events.length === 0) return;
  const sql = connect();
  if (!sql) return;

  const ids = events.map(() => randomUUID());
  const seqs = events.map((e) => e.seq);
  const ticks = events.map((e) => e.tick);
  const minutes = events.map((e) => e.minute);
  const sides = events.map((e) => e.side);
  const types = events.map((e) => e.type);
  const outcomes = events.map((e) => e.outcome);
  // Rounded at the boundary: `real` has ~7 significant digits, and storing 14 of
  // them means the value that comes back never equals the one that went in.
  const xs = events.map((e) => Math.round(e.x * 100) / 100);
  const ys = events.map((e) => Math.round(e.y * 100) / 100);
  const xgs = events.map((e) => (e.xg === null ? null : Math.round(e.xg * 10000) / 10000));
  const round2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);
  const endXs = events.map((e) => round2(e.endX));
  const endYs = events.map((e) => round2(e.endY));
  const endZs = events.map((e) => round2(e.endZ));
  const shirts = events.map((e) => e.shirt);
  const secondary = events.map((e) => e.secondaryShirt);

  await sql`
    insert into match_event (
      id, match_id, seq, tick, minute, side, type, outcome,
      x, y, xg, end_x, end_y, end_z, shirt, secondary_shirt
    )
    select
      u.id, ${matchId}, u.seq, u.tick, u.minute, u.side, u.type, u.outcome,
      u.x, u.y, u.xg, u.end_x, u.end_y, u.end_z, u.shirt, u.secondary_shirt
    from unnest(
      ${ids}::text[], ${seqs}::int[], ${ticks}::int[], ${minutes}::int[],
      ${sides}::text[], ${types}::text[], ${outcomes}::text[],
      ${xs}::real[], ${ys}::real[], ${xgs}::real[],
      ${endXs}::real[], ${endYs}::real[], ${endZs}::real[],
      ${shirts}::int[], ${secondary}::int[]
    ) as u(
      id, seq, tick, minute, side, type, outcome,
      x, y, xg, end_x, end_y, end_z, shirt, secondary_shirt
    )
  `;
}
