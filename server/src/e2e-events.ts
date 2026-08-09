/**
 * Phase 04, end to end: play a real match through the real room and then go
 * looking for it in Postgres.
 *
 * `events:verify` proves the sim's events are complete and that the write path
 * round-trips. It does not prove the ROOM uses that write path correctly —
 * whether the buffer really flushes every five ticks, whether the final flush
 * beats the completion update, whether the broadcast a client receives is the
 * same log that was stored. Those are the bugs that only show up when a whole
 * match is played, so this plays one.
 *
 *   npm --prefix server run dev          # in another terminal
 *   npm --prefix server run events:e2e
 *
 * It takes about 100 seconds, because a match takes 90.
 */

import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { SignJWT } from "jose";
import { Client, type Room } from "colyseus.js";
import { forceIpv4IfRequested } from "./force-ipv4.js";
import { totalsFrom, type MatchEvent } from "./sim/events.js";

const endpoint = process.argv[2] ?? "ws://localhost:2567";

const failures: string[] = [];
function check(name: string, held: boolean, note = "") {
  if (!held) failures.push(name);
  console.log(`  ${held ? "OK  " : "FAIL"}  ${name}${note ? ` — ${note}` : ""}`);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type AnyState = {
  phase: string;
  tick: number;
  home: { goals: number; shots: number; xg: number };
  away: { goals: number; shots: number; xg: number };
};

async function main() {
  await forceIpv4IfRequested();

  const url = process.env.DATABASE_URL;
  const secret = process.env.MATCH_TICKET_SECRET;
  if (!url || !secret) {
    console.error("DATABASE_URL and MATCH_TICKET_SECRET must both be set.");
    process.exit(1);
  }
  const sql = neon(url);

  // A throwaway account. `match.home_user_id` is a real foreign key, so a made
  // up id would fail the insert and the run would fail for the wrong reason.
  const userId = randomUUID();
  const email = `e2e-${userId.slice(0, 8)}@futtrade.test`;
  await sql`
    insert into "user" (id, name, email, email_verified, created_at, updated_at)
    values (${userId}, 'Phase 04 E2E', ${email}, true, now(), now())
  `;

  console.log(`\nPhase 04 end-to-end — ${endpoint}`);
  console.log(`test account ${email}\n`);

  let roomId = "";
  try {
    const ticket = await new SignJWT({ username: "Phase04E2E" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setJti(randomUUID())
      .setIssuer("futtrade-app")
      .setAudience("futtrade-match")
      .setExpirationTime("60s")
      .sign(new TextEncoder().encode(secret));

    // `create`, not `joinOrCreate`: matchmaking would drop this client into
    // whatever room happens to be open — including one left at full time by the
    // previous run, which is exactly how the first attempt at this test
    // "passed" with zero events.
    const room: Room = await new Client(endpoint).create("match", { ticket });
    roomId = room.roomId;

    // Everything the client is told, live. This is the feed Phase 06 will draw.
    const broadcast: MatchEvent[] = [];
    room.onMessage("events", (batch: MatchEvent[]) => broadcast.push(...batch));

    const st = () => room.state as unknown as AnyState;
    await wait(600);
    room.send("kickoff");
    console.log(`kicked off in room ${roomId}; a match takes 90 seconds…`);

    const deadline = Date.now() + 150_000;
    let lastReported = 0;
    while (st().phase !== "fulltime" && Date.now() < deadline) {
      await wait(1000);
      if (st().tick > lastReported && st().tick % 10 === 0) {
        lastReported = st().tick;
        console.log(`  tick ${st().tick}: ${broadcast.length} events received`);
      }
    }

    const final = {
      phase: st().phase,
      goals: [st().home.goals, st().away.goals] as const,
      shots: [st().home.shots, st().away.shots] as const,
      xg: [st().home.xg, st().away.xg] as const,
    };
    console.log(
      `\nfull time ${final.goals[0]}-${final.goals[1]}, ` +
        `${broadcast.length} events broadcast\n`,
    );

    // The last flush and the completion update are async and fire after the
    // state flips to fulltime.
    await wait(4000);
    await room.leave(true);

    check("the match reached full time", final.phase === "fulltime", final.phase);

    const matches = (await sql`
      select id, status, home_score, away_score, home_shots, away_shots, home_xg
      from "match" where room_id = ${roomId} order by started_at desc limit 1
    `) as Record<string, string | number>[];

    check("a match row exists for the room", matches.length === 1);
    if (matches.length !== 1) return;
    const stored = matches[0];
    const matchId = String(stored.id);

    check("it is marked finished", stored.status === "finished", String(stored.status));
    check(
      "the stored score is the room's score",
      Number(stored.home_score) === final.goals[0] &&
        Number(stored.away_score) === final.goals[1],
      `${stored.home_score}-${stored.away_score}`,
    );

    const rows = (await sql`
      select seq, tick, minute, side, type, outcome, x, y, xg, shirt, secondary_shirt
      from match_event where match_id = ${matchId} order by seq
    `) as Record<string, unknown>[];

    const stored_events: MatchEvent[] = rows.map((r) => ({
      seq: Number(r.seq), tick: Number(r.tick), minute: Number(r.minute),
      side: r.side as MatchEvent["side"], type: r.type as MatchEvent["type"],
      outcome: String(r.outcome), x: Number(r.x), y: Number(r.y),
      xg: r.xg === null ? null : Number(r.xg),
      shirt: Number(r.shirt),
      secondaryShirt: r.secondary_shirt === null ? null : Number(r.secondary_shirt),
    }));

    check(
      "every broadcast event was persisted",
      stored_events.length === broadcast.length,
      `${broadcast.length} broadcast, ${stored_events.length} stored`,
    );

    // No gaps — the exit criterion, asked of the database rather than of memory.
    const gapped = stored_events.findIndex((e, i) => e.seq !== i + 1);
    check(
      "seq is contiguous 1..N with no gaps",
      gapped === -1,
      gapped === -1 ? `${stored_events.length} rows` : `first break at index ${gapped}`,
    );

    // The live feed and the stored log must be the same thing. If they can
    // disagree, every chart drawn from one contradicts the other.
    const sameAsBroadcast = stored_events.every((e, i) => {
      const b = broadcast[i];
      return (
        b && b.seq === e.seq && b.type === e.type && b.outcome === e.outcome &&
        b.side === e.side && b.shirt === e.shirt && b.minute === e.minute
      );
    });
    check("the live feed matches the stored log event for event", sameAsBroadcast);

    // And finally the reconstruction the whole phase exists for.
    const home = totalsFrom(stored_events, "home");
    const away = totalsFrom(stored_events, "away");
    check(
      "goals reconstruct from the events alone",
      home.goals === final.goals[0] && away.goals === final.goals[1],
      `${home.goals}-${away.goals} from events`,
    );
    check(
      "shots reconstruct from the events alone",
      home.shots === final.shots[0] && away.shots === final.shots[1],
      `${home.shots}/${away.shots} from events, ${final.shots[0]}/${final.shots[1]} in the room`,
    );
    check(
      "xG reconstructs from the events alone",
      Math.abs(home.xg - final.xg[0]) <= 0.02,
      `${home.xg.toFixed(2)} from events, ${final.xg[0].toFixed(2)} in the room`,
    );
    check(
      "the stored aggregate agrees with the log",
      Number(stored.home_shots) === home.shots &&
        Math.abs(Number(stored.home_xg) - home.xg) <= 0.02,
      `${stored.home_shots} shots, xG ${Number(stored.home_xg).toFixed(2)}`,
    );

    const cards = stored_events.filter((e) => e.type === "card");
    console.log(
      `\n  log: ${stored_events.filter((e) => e.type === "shot").length} shots, ` +
        `${stored_events.filter((e) => e.type === "pass").length} passes, ` +
        `${stored_events.filter((e) => e.type === "tackle").length} tackles, ` +
        `${cards.length} cards`,
    );

    await sql`delete from "match" where id = ${matchId}`;

    await abandonedMatch(secret, userId);
  } finally {
    await sql`delete from "user" where id = ${userId}`;
    console.log("  cleaned up the test account and match");
  }

  console.log(
    failures.length ? `\nFAILED: ${failures.join(", ")}\n` : "\nAll end-to-end checks held.\n",
  );
  process.exit(failures.length ? 1 : 0);
}

/**
 * The other half of the lifecycle: a match that never reaches full time.
 *
 * Opening the row at kickoff is only worth anything if an abandoned match is
 * visibly abandoned. Otherwise it sits at `status = 'live'` forever and looks
 * identical to one still being played — which is exactly the silence the design
 * was meant to avoid. Claimed in docs/features/03-event-stream.md, so proved
 * here rather than assumed.
 */
async function abandonedMatch(secret: string, userId: string) {
  console.log("\nABANDONED MATCH — kick off, walk away, never come back");

  const sql = neon(process.env.DATABASE_URL!);

  const ticket = await new SignJWT({ username: "Phase04E2E" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuer("futtrade-app")
    .setAudience("futtrade-match")
    .setExpirationTime("60s")
    .sign(new TextEncoder().encode(secret));

  const room: Room = await new Client(endpoint).create("match", { ticket });
  const roomId = room.roomId;
  // Registered only to keep colyseus.js from warning about an unhandled type.
  room.onMessage("events", () => {});
  await wait(600);
  room.send("kickoff");

  // Long enough for at least one mid-match flush, so the partial log is real.
  await wait(20_000);
  const tickAtExit = (room.state as unknown as AnyState).tick;
  await room.leave(true);
  console.log(`  left room ${roomId} at tick ${tickAtExit}; the room disposes after its 60s grace`);

  // The empty-room grace, plus room for the sweep to land.
  await wait(70_000);

  const rows = (await sql`
    select id, status from "match" where room_id = ${roomId} limit 1
  `) as Record<string, string>[];

  check("the abandoned match still has a row", rows.length === 1);
  if (rows.length !== 1) return;
  check(
    "it is marked abandoned, not left claiming to be live",
    rows[0].status === "abandoned",
    rows[0].status,
  );

  const events = (await sql`
    select seq, tick from match_event where match_id = ${rows[0].id} order by seq
  `) as { seq: number; tick: number }[];
  const lastTick = events.length ? Number(events[events.length - 1].tick) : 0;
  check(
    "the partial log survived, contiguous to the moment it stopped",
    events.length > 0 && events.every((e, i) => Number(e.seq) === i + 1),
    `${events.length} events, last at tick ${lastTick}`,
  );
  // The client left at `tickAtExit` but the room played on through its 60s
  // disposal grace — a manager walking out does not stop the match, per
  // docs/concerns/02-realtime-sync-reconnection.md. So the log runs well past
  // the moment the client disconnected, and that is the correct behaviour.
  check(
    "the match played on after the client left, as the disconnect policy requires",
    lastTick > tickAtExit,
    `client left at tick ${tickAtExit}, log reaches ${lastTick}`,
  );

  await sql`delete from "match" where id = ${rows[0].id}`;
}

void main();
