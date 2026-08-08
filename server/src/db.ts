import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

/**
 * The match server's own write path to Neon.
 *
 * Giving the match server database access is deliberate. Phase 04 persists the
 * event stream, which AGENTS.md calls the spine of the system, and that stream
 * is produced here — routing it back through the Next.js app would add a
 * network hop and a second failure mode to the most write-heavy path in the
 * product. It writes results; it never reads user data.
 *
 * Raw SQL over the HTTP driver rather than Drizzle: this is one statement, and
 * the schema is defined once in the app's lib/db/schema.ts. Two Drizzle schema
 * definitions across two packages would be a second source of truth waiting to
 * drift.
 */

export type MatchResultRow = {
  roomId: string;
  homeUserId: string | null;
  awayUserId: string | null;
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

export async function saveMatchResult(row: MatchResultRow): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Loud, not silent. A result that vanishes without a word is worse than one
    // that fails — the managers would never know their match wasn't recorded.
    console.warn(
      "[match] DATABASE_URL is not set on the match server; result not persisted",
    );
    return;
  }

  const sql = neon(url);
  await sql`
    insert into "match" (
      id, room_id, home_user_id, away_user_id,
      home_score, away_score, home_shots, away_shots,
      home_xg, away_xg, home_possession,
      home_mentality, home_pressing, away_mentality, away_pressing,
      finished_at
    ) values (
      ${randomUUID()}, ${row.roomId}, ${row.homeUserId}, ${row.awayUserId},
      ${row.homeScore}, ${row.awayScore}, ${row.homeShots}, ${row.awayShots},
      ${row.homeXg}, ${row.awayXg}, ${row.homePossession},
      ${row.homeMentality}, ${row.homePressing},
      ${row.awayMentality}, ${row.awayPressing},
      now()
    )
  `;
}
