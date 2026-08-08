import {
  simulateMatch,
  TICKS_PER_MATCH,
  type MatchResult,
} from "./match-sim.js";
import { DEFAULT_DIALS, type Dials, type Mentality, type Pressing } from "./dials.js";

/**
 * The Phase 02 exit criterion, measured rather than asserted.
 *
 * "Repeated simulated matches with identical starting ratings, run under
 * different dial settings, show a measurable and sensible difference in average
 * score/possession — not just noise." That is a claim about a distribution, and
 * a handful of hand-played matches cannot establish one. This runs thousands.
 *
 *   npm run sim:tune
 */

const RUNS = 20_000;

type Summary = {
  goalsFor: number;
  goalsAgainst: number;
  totalGoals: number;
  shots: number;
  xg: number;
  possession: number;
  nilNil: number;
  fourPlus: number;
  sevenPlus: number;
  winRate: number;
  drawRate: number;
  awayWinRate: number;
};

function summarise(home: Dials, away: Dials, runs = RUNS): Summary {
  let gf = 0, ga = 0, shots = 0, xg = 0, poss = 0;
  let nilNil = 0, fourPlus = 0, sevenPlus = 0, wins = 0, draws = 0;

  for (let i = 0; i < runs; i++) {
    // A distinct seed per run; the sim is deterministic given one, so any
    // result here can be reproduced exactly.
    const r: MatchResult = simulateMatch(home, away, i + 1);
    gf += r.home.goals;
    ga += r.away.goals;
    shots += r.home.shots;
    xg += r.home.xg;
    poss += r.homePossession;
    const total = r.home.goals + r.away.goals;
    if (total === 0) nilNil++;
    if (total >= 4) fourPlus++;
    if (total >= 7) sevenPlus++;
    if (r.home.goals > r.away.goals) wins++;
    else if (r.home.goals === r.away.goals) draws++;
  }

  return {
    goalsFor: gf / runs,
    goalsAgainst: ga / runs,
    totalGoals: (gf + ga) / runs,
    shots: shots / runs,
    xg: xg / runs,
    possession: poss / runs,
    nilNil: (nilNil / runs) * 100,
    fourPlus: (fourPlus / runs) * 100,
    sevenPlus: (sevenPlus / runs) * 100,
    winRate: (wins / runs) * 100,
    drawRate: (draws / runs) * 100,
    awayWinRate: ((runs - wins - draws) / runs) * 100,
  };
}

const n = (v: number, d = 2) => v.toFixed(d).padStart(6);

console.log(`\n${RUNS.toLocaleString()} matches per row · ${TICKS_PER_MATCH} ticks each\n`);

/* ── 1. Is the baseline plausible football? ─────────────────────────────── */
const base = summarise(DEFAULT_DIALS, DEFAULT_DIALS);
console.log("BASELINE  balanced/medium vs balanced/medium");
console.log(`  total goals   ${n(base.totalGoals)}   target 2.5 – 3.0`);
console.log(`  shots (home)  ${n(base.shots)}   target ~13 per side`);
console.log(`  xG (home)     ${n(base.xg)}`);
console.log(`  0-0 rate      ${n(base.nilNil, 1)}%  target 7 – 10%`);
console.log(`  4+ goals      ${n(base.fourPlus, 1)}%  target ~20%`);
console.log(`  7+ goals      ${n(base.sevenPlus, 1)}%  target under 2%`);
console.log(`  home win/draw ${n(base.winRate, 1)}% / ${n(base.drawRate, 1)}%  target ~even`);

const ok = (label: string, pass: boolean) =>
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}`);
console.log("");
ok("goals in 2.5 – 3.0", base.totalGoals >= 2.5 && base.totalGoals <= 3.0);
ok("0-0 in 7 – 10%", base.nilNil >= 7 && base.nilNil <= 10);
ok("7+ goals under 2%", base.sevenPlus < 2);
// Both sides are identical, so the two win rates must match. Checking home
// against an absolute band was wrong — with ~22% draws, ~39% each IS symmetry.
ok(
  `symmetric (home ${base.winRate.toFixed(1)}% vs away ${base.awayWinRate.toFixed(1)}%)`,
  Math.abs(base.winRate - base.awayWinRate) < 2,
);

/* ── 2. Does each dial actually change the outcome? ─────────────────────── */
console.log("\nMENTALITY  (opponent always balanced/medium)");
console.log("            for  against    shots  poss%   win%");
for (const m of ["defensive", "balanced", "attacking"] as Mentality[]) {
  const s = summarise({ mentality: m, pressing: "medium" }, DEFAULT_DIALS);
  console.log(
    `  ${m.padEnd(10)}${n(s.goalsFor)} ${n(s.goalsAgainst)}  ${n(s.shots)} ${n(s.possession, 1)} ${n(s.winRate, 1)}`,
  );
}

console.log("\nPRESSING  (opponent always balanced/medium)");
console.log("            for  against    shots  poss%   win%");
for (const p of ["low", "medium", "high"] as Pressing[]) {
  const s = summarise({ mentality: "balanced", pressing: p }, DEFAULT_DIALS);
  console.log(
    `  ${p.padEnd(10)}${n(s.goalsFor)} ${n(s.goalsAgainst)}  ${n(s.shots)} ${n(s.possession, 1)} ${n(s.winRate, 1)}`,
  );
}

/* ── 2b. Is the difference real, or is it noise? ─────────────────────────
   The exit criterion says "measurable and sensible difference ... not just
   noise". That is a statistical claim, so it gets a statistical answer rather
   than a glance at the table: the 95% confidence interval on the difference in
   means must exclude zero. ─────────────────────────────────────────────────*/

function goalSamples(home: Dials, away: Dials, runs = RUNS): number[] {
  const out: number[] = [];
  for (let i = 0; i < runs; i++) out.push(simulateMatch(home, away, i + 1).home.goals);
  return out;
}

function possessionSamples(home: Dials, away: Dials, runs = RUNS): number[] {
  const out: number[] = [];
  for (let i = 0; i < runs; i++) out.push(simulateMatch(home, away, i + 1).homePossession);
  return out;
}

function meanAndSe(xs: number[]) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return { mean: m, se: Math.sqrt(v / xs.length) };
}

/** Welch 95% CI on the difference of two means. */
function difference(a: number[], b: number[]) {
  const x = meanAndSe(a), y = meanAndSe(b);
  const diff = x.mean - y.mean;
  const se = Math.sqrt(x.se ** 2 + y.se ** 2);
  return { diff, lo: diff - 1.96 * se, hi: diff + 1.96 * se };
}

console.log("\nSIGNIFICANCE  95% CI on the difference vs balanced/medium");
const tests: [string, Dials, "goals" | "possession"][] = [
  ["attacking scores more", { mentality: "attacking", pressing: "medium" }, "goals"],
  ["defensive scores less", { mentality: "defensive", pressing: "medium" }, "goals"],
  ["high press holds more ball", { mentality: "balanced", pressing: "high" }, "possession"],
  ["low press holds less ball", { mentality: "balanced", pressing: "low" }, "possession"],
];

const baseGoals = goalSamples(DEFAULT_DIALS, DEFAULT_DIALS);
const basePoss = possessionSamples(DEFAULT_DIALS, DEFAULT_DIALS);

for (const [label, dials, metric] of tests) {
  const sample = metric === "goals"
    ? goalSamples(dials, DEFAULT_DIALS)
    : possessionSamples(dials, DEFAULT_DIALS);
  const baseline = metric === "goals" ? baseGoals : basePoss;
  const { diff, lo, hi } = difference(sample, baseline);
  const excludesZero = lo > 0 || hi < 0;
  console.log(
    `  ${(diff > 0 ? "+" : "") + diff.toFixed(3)} ${metric === "goals" ? "goals" : "pp"}  ` +
    `[${lo.toFixed(3)}, ${hi.toFixed(3)}]  ${excludesZero ? "PASS" : "FAIL"}  ${label}`,
  );
}

/* ── 3. Is there a dominant setting? ────────────────────────────────────── */
console.log("\nDOMINANCE CHECK  win rate of each setting vs balanced/medium");
const combos: Dials[] = [];
for (const m of ["defensive", "balanced", "attacking"] as Mentality[])
  for (const p of ["low", "medium", "high"] as Pressing[])
    combos.push({ mentality: m, pressing: p });

const rates = combos.map((c) => ({
  label: `${c.mentality}/${c.pressing}`,
  win: summarise(c, DEFAULT_DIALS, 8000).winRate,
}));
rates.sort((a, b) => b.win - a.win);
for (const r of rates) console.log(`  ${r.label.padEnd(20)} ${n(r.win, 1)}%`);

const spread = rates[0].win - rates[rates.length - 1].win;
console.log("");
ok(
  `no runaway best setting (spread ${spread.toFixed(1)}pp, want under 12)`,
  spread < 12,
);
ok(
  "every setting beatable (best under 56%)",
  rates[0].win < 56,
);
console.log("");
