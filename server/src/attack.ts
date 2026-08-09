/**
 * The Phase 03 adversarial client.
 *
 * Exit criterion: "a scripted adversarial client cannot alter match outcome or
 * bypass rate limits; all rejected attempts are logged."
 *
 * So this genuinely tries. It is not a mock — it opens a real socket to a real
 * room and sends what a modified client would send. Each attack asserts on room
 * STATE afterwards, because the only thing that matters is whether the server's
 * view of the match moved. A refusal message is nice; an unchanged score is the
 * actual guarantee.
 *
 * It mints its own tickets from a real session, exactly as an attacker with an
 * account would — and because escalation disconnects a persistently abusive
 * client (by design), each attack that needs a live socket gets a fresh one.
 * Otherwise the guardrails would cut the test short and the later attacks would
 * never actually be attempted.
 *
 *   npx tsx src/attack.ts <cookieFile> [appUrl] [wsUrl]
 */

import fs from "node:fs";
import { Client, type Room } from "colyseus.js";

const cookieFile = process.argv[2];
const appUrl = process.argv[3] ?? "http://localhost:3000";
const endpoint = process.argv[4] ?? "ws://localhost:2567";

if (!cookieFile) {
  console.error("usage: tsx src/attack.ts <cookieFile> [appUrl] [wsUrl]");
  process.exit(1);
}

/** The cookie jar of a signed-in account, as an attacker would have. */
const cookie = fs
  .readFileSync(cookieFile, "utf8")
  .split("\n")
  // curl writes httpOnly cookies with a "#HttpOnly_" prefix, which is NOT a
  // comment — and the session cookie is httpOnly, so filtering every "#" line
  // silently drops the only one that matters.
  .map((l) => (l.startsWith("#HttpOnly_") ? l.slice("#HttpOnly_".length) : l))
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => { const p = l.split("\t"); return p.length >= 7 ? `${p[5]}=${p[6]}` : ""; })
  .filter(Boolean)
  .join("; ");

/** The real guarantee: the SERVER survives, whatever happens to one client. */
async function serverAlive(): Promise<boolean> {
  try {
    const res = await fetch(`${endpoint.replace(/^ws/, "http")}/healthz`);
    return res.ok;
  } catch {
    return false;
  }
}

/** leave() on an already-closed socket never settles. */
async function safeLeave(r: Room) {
  if (r.connection?.isOpen) await r.leave(true);
}

async function mintTicket(): Promise<string> {
  const res = await fetch(`${appUrl}/api/match/ticket`, {
    method: "POST",
    headers: { cookie },
  });
  if (!res.ok) throw new Error(`ticket mint failed: ${res.status}`);
  const body = (await res.json()) as { ticket: string };
  return body.ticket;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const passed: string[] = [];
const failed: string[] = [];
function check(name: string, held: boolean, note = "") {
  (held ? passed : failed).push(name);
  console.log(`  ${held ? "HELD" : "BREACHED"}  ${name}${note ? ` — ${note}` : ""}`);
}

type AnyState = {
  phase: string;
  tick: number;
  minute: number;
  home: { goals: number; shots: number };
  away: { goals: number };
  players: Map<string, { mentality: string; pressing: string; changesUsed: number }>;
};
const st = (room: Room) => room.state as unknown as AnyState;
const mySlot = (room: Room) => [...st(room).players.values()][0];

let refusals = 0;

/** A fresh, un-escalated connection — the guardrails kick abusive ones. */
async function freshRoom(): Promise<Room> {
  const r = await new Client(endpoint).joinOrCreate("match", {
    ticket: await mintTicket(),
  });
  r.onMessage("rejected", () => refusals++);
  r.onMessage("warning", () => {});
  await wait(700);
  return r;
}

let room = await freshRoom();

console.log("\n1. FABRICATED STATE — declaring outcomes instead of intent");
{
  const before = { goals: st(room).home.goals, tick: st(room).tick, phase: st(room).phase };
  for (const [type, payload] of [
    ["setScore", { home: 99, away: 0 }],
    ["goal", { side: "home", count: 10 }],
    ["tick", { tick: 999 }],
    ["setPhase", { phase: "fulltime" }],
    ["state", { home: { goals: 50 } }],
    // Object.prototype keys used as message types. Each of these crashed the
    // whole server before the dispatch registry was given a null prototype.
    ["__proto__", { polluted: true }],
    ["constructor", { polluted: true }],
    ["toString", {}],
    ["valueOf", {}],
    ["hasOwnProperty", {}],
  ] as [string, unknown][]) {
    room.send(type, payload);
    await wait(120);
  }
  await wait(800);
  const after = st(room);
  check("score unchanged", after.home.goals === before.goals, `${before.goals} → ${after.home.goals}`);
  check("tick not forced", after.tick <= before.tick + 2, `${before.tick} → ${after.tick}`);
  check("phase not forced", after.phase === before.phase, after.phase);
  check(
    "prototype not polluted",
    ({} as Record<string, unknown>).polluted === undefined,
  );
  check("server survived prototype-key messages", room.connection.isOpen);
}

console.log("\n2. MALFORMED AND HOSTILE PAYLOADS");
{
  const before = st(room).phase;
  const hostile: unknown[] = [
    null,
    undefined,
    "attacking",
    12345,
    [],
    { mentality: null, pressing: null },
    { mentality: { toString: "nope" }, pressing: [] },
    { mentality: "x".repeat(50_000), pressing: "high" },
    { mentality: "attacking", pressing: "high", extra: { deep: { deeper: {} } } },
  ];
  for (const payload of hostile) {
    room.send("dials", payload);
    await wait(120);
  }
  await wait(800);
  // Not "this socket survived" — escalation kicks an abusive client on purpose,
  // which is the guardrail working. What must hold is that the SERVER survived.
  check("server still accepting connections", await serverAlive());
  check("phase unchanged", st(room).phase === before);
  check("hostile payloads refused", refusals > 0, `${refusals} refusals so far`);
}

console.log("\n3. RATE LIMIT AND BUDGET BYPASS");
{
  // Sections 1-2 deliberately provoked enough refusals to trip escalation, so
  // this needs a clean socket to test the budget rather than the kick.
  await safeLeave(room);
  room = await freshRoom();
  room.send("dials", { mentality: "attacking", pressing: "high" });
  await wait(400);
  room.send("kickoff");
  await wait(3600);
  check("match is live", st(room).phase === "live", st(room).phase);

  const burstBefore = mySlot(room).changesUsed;
  // As fast as the socket allows, alternating so each is a genuine change.
  for (let i = 0; i < 40; i++) {
    room.send("dials", {
      mentality: i % 2 ? "defensive" : "attacking",
      pressing: i % 2 ? "low" : "high",
    });
  }
  await wait(2500);
  const used = mySlot(room).changesUsed;
  check(
    "burst did not bypass the budget",
    used <= 3,
    `changesUsed ${burstBefore} → ${used}, cap 3`,
  );

  // The burst above is refused so fast that escalation kicks the client before
  // the budget is meaningfully exercised — so it passes for the wrong reason.
  // This spends changes at a LEGAL cadence, which is the only way to prove the
  // cap itself holds rather than the rate limiter hiding it.
  await safeLeave(room);
  room = await freshRoom();
  room.send("kickoff");
  await wait(3600);

  const settings: [string, string][] = [
    ["attacking", "high"], ["defensive", "low"], ["balanced", "medium"],
    ["attacking", "low"], ["defensive", "high"],
  ];
  const spent: number[] = [];
  for (const [mentality, pressing] of settings) {
    room.send("dials", { mentality, pressing });
    await wait(2000);
    spent.push(mySlot(room).changesUsed);
  }
  check(
    "exactly 3 changes accepted at a legal cadence",
    mySlot(room).changesUsed === 3,
    `progression ${spent.join(" → ")}, cap 3`,
  );
  check("the 4th and 5th were refused", spent[3] === 3 && spent[4] === 3);
}

console.log("\n4. IDENTITY — replay, forgery, double-join");
{
  // Spend a ticket legitimately, then try to reuse the very same one.
  const used = await mintTicket();
  const first = await new Client(endpoint).joinOrCreate("match", { ticket: used });
  await safeLeave(first);
  try {
    await new Client(endpoint).joinOrCreate("match", { ticket: used });
    check("ticket replay refused", false, "a spent ticket was accepted");
  } catch (e) {
    check("ticket replay refused", true, String((e as Error).message).slice(0, 46));
  }

  try {
    await new Client(endpoint).joinOrCreate("match", {
      ticket: used.slice(0, -6) + "AAAAAA",
    });
    check("forged ticket refused", false, "a forged signature was accepted");
  } catch (e) {
    check("forged ticket refused", true, String((e as Error).message).slice(0, 46));
  }

  try {
    await new Client(endpoint).joinOrCreate("match", {});
    check("ticketless join refused", false);
  } catch (e) {
    check("ticketless join refused", true, String((e as Error).message).slice(0, 46));
  }
}

console.log("\n5. ESCALATION — repeated abuse is disconnected");
{
  await safeLeave(room);
  room = await freshRoom();
  let kicked = false;
  room.onLeave((code) => { if (code === 4001) kicked = true; });
  for (let i = 0; i < 60; i++) room.send("setScore", { home: 99 });
  await wait(2500);
  check("abusive client disconnected", kicked || !room.connection.isOpen, kicked ? "code 4001" : "socket closed");
}

console.log(
  `\n${passed.length}/${passed.length + failed.length} guarantees held` +
    (failed.length ? `  BREACHED: ${failed.join(", ")}` : ""),
);
console.log(`refusals received: ${refusals}`);
console.log(`server alive at the end: ${await serverAlive()}\n`);
process.exit(failed.length ? 1 : 0);
