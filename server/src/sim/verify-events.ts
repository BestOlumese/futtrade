/**
 * The Phase 04 exit criterion, made executable.
 *
 *   "A completed match's event log fully reconstructs the match's
 *    shots/passes/cards with no gaps, verified against the sim's internal state."
 *
 * So this reconstructs matches from their events ALONE and requires the result
 * to equal what the sim privately recorded. Reading the emitting code and
 * agreeing that it looks right is not verification; a mismatch on run 1,437 is.
 *
 *   npm --prefix server run events:verify [runs]
 *
 * With DATABASE_URL set it goes further and round-trips one match through the
 * real write path into Postgres and back, because "queryable and complete" is a
 * claim about the database, not about an array in memory.
 */

import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { forceIpv4IfRequested } from "../force-ipv4.js";
import { MENTALITIES, PRESSING, type Dials } from "./dials.js";
import { simulateMatch, TICKS_PER_MATCH, type MatchResult } from "./match-sim.js";
import { completeMatch, insertEvents, openMatch } from "../db.js";
import { totalsFrom, type MatchEvent, type Side } from "./events.js";

const RUNS = Number(process.argv[2] ?? 2000);

const failures: string[] = [];
let checks = 0;

function must(condition: boolean, message: string) {
  checks++;
  if (!condition && failures.length < 25) failures.push(message);
  else if (!condition) failures.push("…");
}

/** xG is stored as `real` (float32) and rounded on the way in. */
const near = (a: number, b: number, tolerance = 0.02) => Math.abs(a - b) <= tolerance;

const VALID_OUTCOMES: Record<string, Set<string>> = {
  shot: new Set(["goal", "saved", "off_target", "blocked"]),
  pass: new Set(["complete", "incomplete"]),
  tackle: new Set(["won", "foul"]),
  card: new Set(["yellow", "red"]),
  sub: new Set(["on"]),
};

/* ── 1. Structure ─────────────────────────────────────────────────────────────
   Properties every log must have regardless of what happened in the match.
   ──────────────────────────────────────────────────────────────────────────*/

function checkStructure(events: MatchEvent[], label: string) {
  // The headline guarantee: seq is 1..N, contiguous, in order. This is what
  // "no gaps" actually means, and it is also enforced by a unique index.
  for (let i = 0; i < events.length; i++) {
    must(events[i].seq === i + 1, `${label}: seq ${events[i].seq} at index ${i}`);
  }

  for (const e of events) {
    must(e.tick >= 1 && e.tick <= TICKS_PER_MATCH, `${label}: tick ${e.tick} out of range`);
    must(e.side === "home" || e.side === "away", `${label}: side ${e.side}`);
    must(e.minute >= 1 && e.minute <= 90, `${label}: minute ${e.minute} out of range`);
    // The display clock must stay inside the tick that produced it.
    must(
      Math.ceil(e.minute / 3) === e.tick,
      `${label}: minute ${e.minute} does not belong to tick ${e.tick}`,
    );

    must(
      VALID_OUTCOMES[e.type]?.has(e.outcome) ?? false,
      `${label}: ${e.type}/${e.outcome} is not in the taxonomy`,
    );

    must(e.x >= 0 && e.x <= 100 && e.y >= 0 && e.y <= 100, `${label}: off-pitch (${e.x}, ${e.y})`);

    // xG belongs to shots and to nothing else — a null on a shot would break
    // every xG chart downstream, and a value on a pass would inflate one.
    must(
      (e.type === "shot") === (e.xg !== null),
      `${label}: xg on a ${e.type}`,
    );
    if (e.xg !== null) must(e.xg > 0 && e.xg <= 0.95, `${label}: xg ${e.xg}`);

    must(e.shirt >= 1 && e.shirt <= 11, `${label}: shirt ${e.shirt}`);
    must(
      e.secondaryShirt === null || (e.secondaryShirt >= 1 && e.secondaryShirt <= 11),
      `${label}: secondary shirt ${e.secondaryShirt}`,
    );
    // Nobody assists their own shot.
    if (e.type === "shot" && e.secondaryShirt !== null) {
      must(e.secondaryShirt !== e.shirt, `${label}: shirt ${e.shirt} assisted itself`);
    }
  }

  // The minute must never go backwards, or a ticker replaying the log in order
  // would jump about.
  for (let i = 1; i < events.length; i++) {
    must(
      events[i].minute >= events[i - 1].minute,
      `${label}: minute went backwards at seq ${events[i].seq}`,
    );
  }

  // A card is always immediately preceded by the foul that earned it — or, for
  // a second booking, by the yellow that preceded the red. Same player, same
  // moment, same place.
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type !== "card") continue;
    const before = events[i - 1];
    must(Boolean(before), `${label}: card at seq ${e.seq} opens the log`);
    if (!before) continue;
    must(
      (before.type === "tackle" && before.outcome === "foul") ||
        (before.type === "card" && before.outcome === "yellow"),
      `${label}: card at seq ${e.seq} follows a ${before.type}/${before.outcome}`,
    );
    must(
      before.side === e.side && before.shirt === e.shirt && before.minute === e.minute,
      `${label}: card at seq ${e.seq} is detached from its foul`,
    );
  }
}

/* ── 2. Reconstruction ────────────────────────────────────────────────────────
   The exit criterion itself: rebuild the match from events and compare.
   ──────────────────────────────────────────────────────────────────────────*/

function checkAgainstSim(result: MatchResult, label: string) {
  for (const side of ["home", "away"] as Side[]) {
    const truth = result[side];
    const built = totalsFrom(result.events, side);

    must(built.shots === truth.shots, `${label}/${side}: shots ${built.shots} vs ${truth.shots}`);
    must(built.goals === truth.goals, `${label}/${side}: goals ${built.goals} vs ${truth.goals}`);
    must(near(built.xg, truth.xg, 1e-9), `${label}/${side}: xG ${built.xg} vs ${truth.xg}`);
    must(built.fouls === truth.fouls, `${label}/${side}: fouls ${built.fouls} vs ${truth.fouls}`);
    must(
      built.yellows === truth.yellows,
      `${label}/${side}: yellows ${built.yellows} vs ${truth.yellows}`,
    );
    must(built.reds === truth.reds, `${label}/${side}: reds ${built.reds} vs ${truth.reds}`);
    // Phase 05: possession is pass share, so these two are no longer cosmetic —
    // a drift here would put a wrong percentage on the stat card.
    must(built.passes === truth.passes, `${label}/${side}: passes ${built.passes} vs ${truth.passes}`);
    must(
      built.tackles === truth.tackles,
      `${label}/${side}: tackles ${built.tackles} vs ${truth.tackles}`,
    );
  }
}

/* ── 3. The run ───────────────────────────────────────────────────────────── */

async function main() {
  await forceIpv4IfRequested();

  console.log(`\nPhase 04 — event log verification (${RUNS} matches)\n`);

  const totals = {
    events: 0, shots: 0, goals: 0, passes: 0, tackles: 0,
    fouls: 0, yellows: 0, reds: 0, assisted: 0,
  };
  let longest = 0;
  const shotDistances: number[] = [];
  const possessionCheck = { fromEvents: 0, fromSim: 0 };

  for (let i = 0; i < RUNS; i++) {
    // Sweep the dial space rather than replaying one setting: a bug in the
    // pressing-driven foul path would never show up at balanced/medium.
    const home: Dials = {
      mentality: MENTALITIES[i % 3],
      pressing: PRESSING[(i >> 2) % 3],
    };
    const away: Dials = {
      mentality: MENTALITIES[(i >> 1) % 3],
      pressing: PRESSING[(i >> 3) % 3],
    };

    const result = simulateMatch(home, away, i + 1, true);
    const label = `seed ${i + 1}`;

    checkStructure(result.events, label);
    checkAgainstSim(result, label);

    // The same seed must produce the same match whether or not anyone is
    // collecting events — otherwise the tuning harness and this verifier are
    // not looking at the same matches, and neither result means much.
    const quiet = simulateMatch(home, away, i + 1, false);
    must(
      quiet.home.goals === result.home.goals &&
        quiet.away.goals === result.away.goals &&
        quiet.home.shots === result.home.shots &&
        near(quiet.home.xg, result.home.xg, 1e-9),
      `${label}: collecting events changed the match`,
    );

    // The stat card's definition, computed the way the app will compute it.
    const homePasses = totalsFrom(result.events, "home").passes;
    const awayPasses = totalsFrom(result.events, "away").passes;
    const total = homePasses + awayPasses;
    possessionCheck.fromEvents += total ? Math.round((homePasses / total) * 100) : 50;
    possessionCheck.fromSim += result.homePossession;

    totals.events += result.events.length;
    longest = Math.max(longest, result.events.length);
    for (const e of result.events) {
      if (e.type === "shot") {
        totals.shots++;
        if (e.outcome === "goal") totals.goals++;
        if (e.secondaryShirt !== null) totals.assisted++;
        // Metres from the centre of the goal, back out of the stored position.
        const dx = ((100 - e.x) * 105) / 100;
        const dy = ((e.y - 50) * 68) / 100;
        shotDistances.push(Math.hypot(dx, dy));
      } else if (e.type === "pass") totals.passes++;
      else if (e.type === "tackle") {
        totals.tackles++;
        if (e.outcome === "foul") totals.fouls++;
      } else if (e.type === "card") {
        if (e.outcome === "yellow") totals.yellows++;
        else totals.reds++;
      }
    }
  }

  const per = (n: number) => (n / RUNS).toFixed(2);
  // Possession must be reproducible from the log alone, since that is exactly
  // what the Phase 05 stat card does.
  must(
    Math.abs(possessionCheck.fromEvents - possessionCheck.fromSim) < 1e-9,
    `possession from events ${possessionCheck.fromEvents} vs from sim ${possessionCheck.fromSim}`,
  );

  console.log("PER MATCH (both sides combined)");
  console.log(`  events          ${per(totals.events)}   peak ${longest}`);
  console.log(`  passes          ${per(totals.passes)}   sampled, not exhaustive`);
  // A foul IS a tackle event, so the two are reported apart — totalling them
  // would read as 53 tackles a match against a real-world 32.
  console.log(`  tackles won     ${per(totals.tackles - totals.fouls)}   real football ~32`);
  console.log(`  fouls           ${per(totals.fouls)}   real football ~22`);
  console.log(`  yellows         ${per(totals.yellows)}   real football ~3.9`);
  console.log(`  reds            ${per(totals.reds)}   real football ~0.10`);
  console.log(`  shots           ${per(totals.shots)}`);
  console.log(`  goals           ${per(totals.goals)}`);
  console.log(
    `  goals assisted  ${((totals.assisted / Math.max(totals.shots, 1)) * 100).toFixed(0)}% of shots`,
  );

  shotDistances.sort((a, b) => a - b);
  const pick = (q: number) => shotDistances[Math.floor(shotDistances.length * q)].toFixed(1);
  console.log("\nSHOT DISTANCE from goal, metres (the shot map's whole point)");
  console.log(`  p10 ${pick(0.1)}   median ${pick(0.5)}   p90 ${pick(0.9)}`);

  // Realism bands. Not the exit criterion, but a silent drift here would make
  // every downstream chart subtly wrong, so it fails loudly.
  const band = (name: string, value: number, lo: number, hi: number) => {
    const ok = value >= lo && value <= hi;
    checks++;
    if (!ok) failures.push(`${name} ${value.toFixed(2)} outside ${lo}–${hi}`);
    return ok;
  };
  console.log("");
  for (const [name, value, lo, hi] of [
    ["fouls per match", totals.fouls / RUNS, 17, 27],
    ["yellows per match", totals.yellows / RUNS, 2.5, 5.5],
    ["reds per match", totals.reds / RUNS, 0.02, 0.25],
    ["passes per match", totals.passes / RUNS, 240, 360],
  ] as [string, number, number, number][]) {
    console.log(
      `  ${band(name, value, lo, hi) ? "PASS" : "FAIL"}  ${name} ${value.toFixed(2)} (want ${lo}–${hi})`,
    );
  }

  await roundTripThroughPostgres();

  console.log(
    `\n${checks - failures.length}/${checks} checks passed` +
      (failures.length ? `\n\nFAILURES:\n  ${failures.slice(0, 25).join("\n  ")}` : ""),
  );
  process.exit(failures.length ? 1 : 0);
}

/* ── 4. The database ──────────────────────────────────────────────────────────
   "Queryable and complete" is a claim about Postgres. An array in memory that
   satisfies every check above proves nothing about what the insert actually
   wrote — so one match goes through the real write path and is read back.
   ──────────────────────────────────────────────────────────────────────────*/

async function roundTripThroughPostgres() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("\nDATABASE_URL not set — skipping the round trip.");
    console.log("The in-memory checks above cannot prove the log is QUERYABLE.");
    return;
  }

  console.log("\nROUND TRIP through Postgres, via the real write path");

  const sql = neon(url);
  const matchId = randomUUID();
  const home: Dials = { mentality: "attacking", pressing: "high" };
  const away: Dials = { mentality: "defensive", pressing: "low" };
  const result = simulateMatch(home, away, Date.now() >>> 0, true);

  try {
    await openMatch({
      matchId,
      roomId: `verify-${matchId.slice(0, 8)}`,
      homeUserId: null,
      awayUserId: null,
      homeMentality: home.mentality, homePressing: home.pressing,
      awayMentality: away.mentality, awayPressing: away.pressing,
    });

    // Flushed in batches of five ticks, exactly as the room does it — so this
    // exercises the real batching, not one convenient single insert.
    for (let tick = 5; tick <= TICKS_PER_MATCH; tick += 5) {
      const batch = result.events.filter((e) => e.tick > tick - 5 && e.tick <= tick);
      await insertEvents(matchId, batch);
    }

    await completeMatch({
      matchId,
      homeScore: result.home.goals, awayScore: result.away.goals,
      homeShots: result.home.shots, awayShots: result.away.shots,
      homeXg: result.home.xg, awayXg: result.away.xg,
      homePossession: result.homePossession,
      homeMentality: home.mentality, homePressing: home.pressing,
      awayMentality: away.mentality, awayPressing: away.pressing,
    });

    const rows = (await sql`
      select seq, tick, minute, side, type, outcome, x, y, xg, shirt, secondary_shirt
      from match_event where match_id = ${matchId} order by seq
    `) as Record<string, unknown>[];

    const read: MatchEvent[] = rows.map((r) => ({
      seq: Number(r.seq), tick: Number(r.tick), minute: Number(r.minute),
      side: r.side as Side, type: r.type as MatchEvent["type"],
      outcome: String(r.outcome), x: Number(r.x), y: Number(r.y),
      xg: r.xg === null ? null : Number(r.xg),
      shirt: Number(r.shirt),
      secondaryShirt: r.secondary_shirt === null ? null : Number(r.secondary_shirt),
    }));

    console.log(`  wrote ${result.events.length} events, read back ${read.length}`);
    must(read.length === result.events.length, "round trip: event count differs");
    checkStructure(read, "postgres");

    // Every field, row by row. A column silently swapped in the unnest would
    // pass a count check and quietly corrupt every chart built on it.
    for (let i = 0; i < Math.min(read.length, result.events.length); i++) {
      const a = read[i];
      const b = result.events[i];
      must(
        a.seq === b.seq && a.tick === b.tick && a.minute === b.minute &&
          a.side === b.side && a.type === b.type && a.outcome === b.outcome &&
          a.shirt === b.shirt && a.secondaryShirt === b.secondaryShirt &&
          near(a.x, b.x, 0.01) && near(a.y, b.y, 0.01) &&
          near(a.xg ?? -1, b.xg ?? -1, 0.001),
        `round trip: row ${b.seq} came back different (${JSON.stringify(a)})`,
      );
    }

    // The gap query the room's failure path relies on being able to detect.
    const [gaps] = (await sql`
      select count(*)::int as n, coalesce(max(seq), 0)::int as top
      from match_event where match_id = ${matchId}
    `) as { n: number; top: number }[];
    must(gaps.n === gaps.top, `round trip: ${gaps.n} rows but max seq ${gaps.top} — a gap`);
    console.log(`  no gaps: ${gaps.n} rows, max seq ${gaps.top}`);

    // The aggregates on `match` are duplication, kept only because they are
    // asserted to agree with the log. This is that assertion.
    const [stored] = (await sql`
      select status, home_score, away_score, home_shots, away_shots, home_xg, away_xg
      from "match" where id = ${matchId}
    `) as Record<string, number | string>[];
    const built = totalsFrom(read, "home");
    must(stored.status === "finished", `round trip: status is ${stored.status}`);
    must(Number(stored.home_score) === built.goals, "round trip: stored score vs event log");
    must(Number(stored.home_shots) === built.shots, "round trip: stored shots vs event log");
    must(near(Number(stored.home_xg), built.xg), `round trip: stored xG ${stored.home_xg} vs event log ${built.xg.toFixed(3)}`);
    console.log(
      `  aggregates agree: ${stored.home_score}-${stored.away_score}, ` +
        `${stored.home_shots} shots, xG ${Number(stored.home_xg).toFixed(2)}`,
    );

    // A retried flush must not duplicate the log. The unique index is what
    // makes the room's retry safe, so it is proved rather than trusted.
    let rejected = false;
    try {
      await insertEvents(matchId, result.events.slice(0, 3));
    } catch {
      rejected = true;
    }
    must(rejected, "round trip: a duplicate flush was ACCEPTED — the seq index is not protecting the log");
    console.log(`  duplicate flush rejected by the unique index: ${rejected}`);
  } finally {
    // Cascade takes the events with it.
    await sql`delete from "match" where id = ${matchId}`;
    console.log("  cleaned up");
  }
}

void main();
