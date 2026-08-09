import { and, asc, desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";
import { match, matchEvent, user } from "@/lib/db/schema";
import type { MatchEventRow, Side, EventType } from "./derive";

/**
 * Reads for the post-match summary.
 *
 * Two queries per page and no more: the match row for its identity and result,
 * and its events for everything else. Every number the page displays is folded
 * out of the second one — see lib/match/derive.ts.
 *
 * Both sides join `user` through an alias rather than looking names up in a
 * loop. Two managers is two aliases; a per-row lookup would be a query per
 * opponent in the history list, which is the classic way a small list gets slow
 * without anyone noticing.
 */

/** An unfilled slot is a real state — a manager may play alone against defaults. */
const DEFAULT_SIDE_NAME = "Default dials";

const homeUser = alias(user, "home_user");
const awayUser = alias(user, "away_user");

export type MatchRecord = {
  id: string;
  roomId: string;
  status: string;
  homeUserId: string | null;
  awayUserId: string | null;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  homeShots: number;
  awayShots: number;
  homeXg: number;
  awayXg: number;
  homePossession: number;
  homeMentality: string;
  homePressing: string;
  awayMentality: string;
  awayPressing: string;
  startedAt: Date;
  finishedAt: Date | null;
};

export async function getMatch(id: string): Promise<MatchRecord | null> {
  const db = getDb();

  const rows = await db
    .select({
      m: match,
      homeName: homeUser.displayUsername,
      awayName: awayUser.displayUsername,
    })
    .from(match)
    // Left joins: a slot can be empty, and a deleted account sets the id null
    // rather than removing the match.
    .leftJoin(homeUser, eq(match.homeUserId, homeUser.id))
    .leftJoin(awayUser, eq(match.awayUserId, awayUser.id))
    .where(eq(match.id, id))
    .limit(1);

  if (rows.length === 0) return null;
  const { m, homeName, awayName } = rows[0];

  return {
    id: m.id,
    roomId: m.roomId,
    status: m.status,
    homeUserId: m.homeUserId,
    awayUserId: m.awayUserId,
    homeName: homeName ?? DEFAULT_SIDE_NAME,
    awayName: awayName ?? DEFAULT_SIDE_NAME,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    homeShots: m.homeShots,
    awayShots: m.awayShots,
    homeXg: m.homeXg,
    awayXg: m.awayXg,
    homePossession: m.homePossession,
    homeMentality: m.homeMentality,
    homePressing: m.homePressing,
    awayMentality: m.awayMentality,
    awayPressing: m.awayPressing,
    startedAt: m.startedAt,
    finishedAt: m.finishedAt,
  };
}

/**
 * The whole event log for a match, in order.
 *
 * Ordered by `seq` rather than by minute: `seq` is the contiguous, gap-free
 * ordering the match server guarantees, and it is what keeps a card immediately
 * after the foul that earned it. Sorting by minute would reshuffle everything
 * that shares one.
 */
export async function getMatchEvents(matchId: string): Promise<MatchEventRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      seq: matchEvent.seq,
      tick: matchEvent.tick,
      minute: matchEvent.minute,
      side: matchEvent.side,
      type: matchEvent.type,
      outcome: matchEvent.outcome,
      x: matchEvent.x,
      y: matchEvent.y,
      xg: matchEvent.xg,
      shirt: matchEvent.shirt,
      secondaryShirt: matchEvent.secondaryShirt,
    })
    .from(matchEvent)
    .where(eq(matchEvent.matchId, matchId))
    .orderBy(asc(matchEvent.seq));

  return rows.map((r) => ({
    ...r,
    side: r.side as Side,
    type: r.type as EventType,
  }));
}

export type MatchListing = {
  id: string;
  homeScore: number;
  awayScore: number;
  /** The signed-in manager's own side, so the list can read from their side. */
  side: Side;
  opponentName: string;
  finishedAt: Date | null;
};

/**
 * A manager's recent finished matches.
 *
 * Only `finished` ones: an abandoned match has no result to show, and a live one
 * belongs in the match room rather than in a history list.
 */
export async function listRecentMatches(
  userId: string,
  limit = 8,
): Promise<MatchListing[]> {
  const db = getDb();
  const rows = await db
    .select({
      m: match,
      homeName: homeUser.displayUsername,
      awayName: awayUser.displayUsername,
    })
    .from(match)
    .leftJoin(homeUser, eq(match.homeUserId, homeUser.id))
    .leftJoin(awayUser, eq(match.awayUserId, awayUser.id))
    .where(
      and(
        eq(match.status, "finished"),
        or(eq(match.homeUserId, userId), eq(match.awayUserId, userId)),
      ),
    )
    .orderBy(desc(match.finishedAt))
    .limit(limit);

  return rows.map(({ m, homeName, awayName }) => {
    const side: Side = m.homeUserId === userId ? "home" : "away";
    return {
      id: m.id,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      side,
      opponentName:
        (side === "home" ? awayName : homeName) ?? DEFAULT_SIDE_NAME,
      finishedAt: m.finishedAt,
    };
  });
}
