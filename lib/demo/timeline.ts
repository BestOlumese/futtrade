/**
 * The landing page's scripted match — ONE event stream driving every animated
 * surface on the page.
 *
 * AGENTS.md: "One event stream powers everything downstream: the live 2D viewer,
 * post-match stats, player Form and market price movement. Get that schema
 * right; treat it as the spine of the whole system."
 *
 * ── Structure ──────────────────────────────────────────────────────────────
 *
 * A single ordered list of BEATS. A beat says who has the ball and what happens
 * as it leaves — pass, shot, or foul. Everything else derives from it: ball
 * position, shot line, tackle flash, feed rows, stats, momentum and price. An
 * earlier version kept possession and events as two schedules and they drifted,
 * so a shot line appeared before the shot. One record makes that impossible.
 *
 * The passage is split into ACTS, each ending in a goal followed by a
 * celebration and a fresh kickoff. Only the last goal gets a full slow-motion
 * hold; the earlier ones get a shorter beat, or celebrations would eat a third
 * of the loop.
 *
 * ── Two clocks ────────────────────────────────────────────────────────────
 *
 * Real loop time advances continuously. PLAY time freezes during kickoffs, the
 * booking and celebrations, and crawls in slow motion. `playClockAt` maps
 * real → play, `realTimeOf` inverts it. Beats live in play time; phases and the
 * price live in real time.
 *
 * `matchStateAt` is pure, so server and client render identically, a section
 * scrolled back into view is instantly in sync, and state at LOOP_MS equals
 * state at 0 — the loop closes on a kickoff.
 *
 * None of this is real data, and it is deliberately not wired to a live match:
 * the landing page has to work when nothing is in progress.
 */

export const LOOP_MS = 96_000;

const MATCH_SPEED = 14; // match seconds per second of PLAY time
const MATCH_START_SECOND = 64 * 60 + 12;

export const HOME = { name: "Kestrel FC", short: "KES" };
export const AWAY = { name: "Ardor SC", short: "ARD" };
export const TRACKED_PLAYER = "A. Delane";

export type Team = "home" | "away";

const HOME_NAMES = [
  "R. Voss", "J. Kavan", "P. Sarn", "L. Idris", "M. Okon",
  "T. Marek", "D. Ferran", "N. Renn", "S. Orsi", "A. Delane", "K. Vance",
];

const AWAY_NAMES = [
  "E. Rask", "G. Holt", "F. Adair", "C. Nyle", "W. Brann",
  "B. Corven", "O. Teal", "R. Vasso", "H. Solt", "V. Marn", "D. Keir",
];

function nameOf(team: Team, idx: number): string {
  return team === "home" ? HOME_NAMES[idx] : AWAY_NAMES[idx];
}

/* ── Acts ────────────────────────────────────────────────────────────────── */

type Act = {
  /** Ball on the centre spot, teams in shape. */
  kickoff: [number, number];
  /** Open play. May contain a stoppage. */
  play: [number, number];
  stoppage?: [number, number];
  /** Real ms at which the ball hits the net. Equals play[1]. */
  goalAt: number;
  slowmoMs: number;
  /** Real ms at which the players have finished walking back. */
  walkbackEnd: number;
};

const ACTS: Act[] = [
  { kickoff: [0, 2_500], play: [2_500, 26_000], goalAt: 26_000, slowmoMs: 1_200, walkbackEnd: 30_000 },
  {
    kickoff: [32_000, 34_000], play: [34_000, 56_000], stoppage: [44_000, 46_000],
    goalAt: 56_000, slowmoMs: 1_200, walkbackEnd: 60_000,
  },
  { kickoff: [62_000, 64_000], play: [64_000, 86_000], goalAt: 86_000, slowmoMs: 3_000, walkbackEnd: 92_000 },
];

function actPlayMs(act: Act): number {
  const stop = act.stoppage ? act.stoppage[1] - act.stoppage[0] : 0;
  return act.play[1] - act.play[0] - stop;
}

export const PLAY_TOTAL = ACTS.reduce((sum, a) => sum + actPlayMs(a), 0); // 65_500

export type Phase =
  | "kickoff" | "play" | "stoppage" | "slowmo" | "walkback" | "set";

export function phaseAt(t: number): Phase {
  for (const act of ACTS) {
    if (t < act.kickoff[0]) return "set";
    if (t < act.kickoff[1]) return "kickoff";
    // Strictly before the goal. AT the goal the ball is already in the net, so
    // that instant belongs to the celebration — otherwise the ball reads from
    // the next act's kickoff beat for a single frame and appears to jump.
    if (t < act.goalAt) {
      if (act.stoppage && t >= act.stoppage[0] && t <= act.stoppage[1]) {
        return "stoppage";
      }
      return "play";
    }
    if (t < act.goalAt + act.slowmoMs) return "slowmo";
    if (t < act.walkbackEnd) return "walkback";
  }
  return "set";
}

function actAt(t: number): Act {
  for (const act of ACTS) {
    if (t < act.walkbackEnd) return act;
  }
  return ACTS[ACTS.length - 1];
}

/** Real loop time → play time. Frozen through kickoffs, the booking and every
 *  celebration; the goal is the last play moment of its act. */
export function playClockAt(t: number): number {
  let acc = 0;
  for (const act of ACTS) {
    if (t < act.kickoff[1]) return acc;
    const total = actPlayMs(act);
    if (t <= act.goalAt) {
      if (act.stoppage) {
        const [s0, s1] = act.stoppage;
        const pre = s0 - act.play[0];
        if (t < s0) return acc + (t - act.play[0]);
        if (t <= s1) return acc + pre;
        return acc + pre + (t - s1);
      }
      return acc + (t - act.play[0]);
    }
    acc += total;
    if (t < act.walkbackEnd) return acc;
  }
  return acc;
}

/** Inverse. At a stoppage it returns the moment play STOPPED — which is when
 *  the foul happened, the useful answer for scheduling. */
export function realTimeOf(playTime: number): number {
  let acc = 0;
  for (const act of ACTS) {
    const total = actPlayMs(act);
    if (playTime <= acc + total) {
      const within = playTime - acc;
      if (act.stoppage) {
        const pre = act.stoppage[0] - act.play[0];
        if (within <= pre) return act.play[0] + within;
        return act.stoppage[1] + (within - pre);
      }
      return act.play[0] + within;
    }
    acc += total;
  }
  return LOOP_MS;
}

const SETTLE_RAMP_MS = 2_000;

function settleAt(t: number): number {
  const phase = phaseAt(t);
  if (phase === "set" || phase === "kickoff") return 0;
  if (phase === "slowmo") return 1;

  const act = actAt(t);
  if (phase === "walkback") {
    const from = act.goalAt + act.slowmoMs;
    return 1 - clamp((t - from) / (act.walkbackEnd - from), 0, 1);
  }
  return clamp((t - act.kickoff[1]) / SETTLE_RAMP_MS, 0, 1);
}

function livenessAt(t: number): number {
  const phase = phaseAt(t);
  if (phase === "stoppage") return 0.12;
  if (phase === "slowmo") return 0.06;
  if (phase === "walkback") return 0.5;
  return 1;
}

/* ── Beats ───────────────────────────────────────────────────────────────── */

export type ShotOutcome = "goal" | "saved" | "blocked" | "off";
export type Arrival =
  | "kickoff" | "pass" | "tackle" | "save" | "block" | "goalkick" | "freekick" | "goal";

type Beat = {
  at: number; // play ms
  team: Team;
  idx: number;
  via: Arrival;
  action: "pass" | "shot" | "foul";
  shot?: {
    outcome: ShotOutcome;
    xg: number;
    note: string;
    /** Perpendicular bend of the flight path — a curled or dinked finish. */
    bend?: number;
    priceStep?: number;
  };
  foulBy?: { team: Team; idx: number; card: "yellow" | "red"; reason: string };
  note?: { type: "Sub"; detail: string };
};

const SHOT_MS = 450;
const RECOVER_MS = 750;
const PASS_FLIGHT_MS = 600;

/** Goals must land on their act's play-time boundary, and the foul on the
 *  stoppage's, because those are the play-time coordinates of the phases. */
const GOAL_1 = 23_500;
const GOAL_2 = 43_500;
const GOAL_3 = PLAY_TOTAL; // 65_500
const FOUL_AT = 33_500;

const BEATS: Beat[] = [
  /* Act 1 — build-up, a block, a save, then a curled finish */
  { at: 0, team: "home", idx: 6, via: "kickoff", action: "pass" },
  { at: 2_000, team: "home", idx: 2, via: "pass", action: "pass" },
  { at: 4_000, team: "away", idx: 8, via: "tackle", action: "pass" },
  { at: 5_800, team: "home", idx: 5, via: "tackle", action: "pass" },
  { at: 7_800, team: "home", idx: 6, via: "pass", action: "pass" },
  {
    at: 9_800, team: "home", idx: 8, via: "pass", action: "shot",
    shot: { outcome: "blocked", xg: 0.09, note: "blocked", priceStep: 0.02 },
  },
  { at: 12_300, team: "away", idx: 3, via: "block", action: "pass" },
  {
    at: 14_300, team: "away", idx: 9, via: "pass", action: "shot",
    shot: { outcome: "saved", xg: 0.31, note: "low to the right" },
  },
  { at: 16_800, team: "home", idx: 0, via: "save", action: "pass" },
  { at: 19_000, team: "home", idx: 6, via: "pass", action: "pass" },
  {
    at: 21_000, team: "home", idx: 9, via: "pass", action: "shot",
    shot: {
      outcome: "goal", xg: 0.44, note: "curled into the far corner",
      bend: 13, priceStep: 0.27,
    },
  },
  { at: GOAL_1, team: "home", idx: 9, via: "goal", action: "pass" },

  /* Act 2 — Ardor restart, a booking, then a first-time volley */
  { at: GOAL_1, team: "away", idx: 6, via: "kickoff", action: "pass" },
  { at: 25_500, team: "away", idx: 5, via: "pass", action: "pass" },
  { at: 27_500, team: "home", idx: 7, via: "tackle", action: "pass" },
  {
    at: 29_500, team: "home", idx: 5, via: "pass", action: "pass",
    note: { type: "Sub", detail: "Renn on for Kavan" },
  },
  {
    at: 31_300, team: "home", idx: 8, via: "pass", action: "foul",
    foulBy: { team: "away", idx: 5, card: "yellow", reason: "dissent" },
  },
  { at: FOUL_AT, team: "home", idx: 8, via: "freekick", action: "pass" },
  { at: 35_500, team: "home", idx: 6, via: "pass", action: "pass" },
  { at: 37_500, team: "home", idx: 10, via: "pass", action: "pass" },
  { at: 39_500, team: "home", idx: 7, via: "pass", action: "pass" },
  {
    at: 41_000, team: "home", idx: 9, via: "pass", action: "shot",
    shot: {
      outcome: "goal", xg: 0.52, note: "first-time volley",
      bend: -9, priceStep: 0.31,
    },
  },
  { at: GOAL_2, team: "home", idx: 9, via: "goal", action: "pass" },

  /* Act 3 — Ardor push, a save, a miss, then a dinked finish */
  { at: GOAL_2, team: "away", idx: 6, via: "kickoff", action: "pass" },
  {
    at: 45_500, team: "away", idx: 9, via: "pass", action: "shot",
    shot: { outcome: "saved", xg: 0.22, note: "tipped over" },
  },
  { at: 48_000, team: "home", idx: 0, via: "save", action: "pass" },
  { at: 50_000, team: "home", idx: 3, via: "pass", action: "pass" },
  { at: 52_000, team: "home", idx: 5, via: "pass", action: "pass" },
  { at: 54_000, team: "home", idx: 7, via: "pass", action: "pass" },
  {
    at: 56_000, team: "home", idx: 8, via: "pass", action: "shot",
    shot: { outcome: "off", xg: 0.12, note: "over", priceStep: 0.03 },
  },
  { at: 58_500, team: "away", idx: 0, via: "goalkick", action: "pass" },
  { at: 60_500, team: "away", idx: 5, via: "pass", action: "pass" },
  {
    at: 62_000, team: "home", idx: 9, via: "tackle", action: "shot",
    shot: {
      outcome: "goal", xg: 0.38, note: "dinked over the keeper",
      bend: 7, priceStep: 0.24,
    },
  },
  { at: GOAL_3, team: "home", idx: 9, via: "goal", action: "pass" },
];

function beatAt(playTime: number) {
  let i = 0;
  for (let k = 0; k < BEATS.length - 1; k++) {
    if (BEATS[k].at <= playTime) i = k;
  }
  return { beat: BEATS[i], next: BEATS[i + 1] ?? BEATS[0] };
}

function shotFireTime(beat: Beat, next: Beat): number {
  return beat.shot?.outcome === "goal"
    ? next.at - SHOT_MS
    : next.at - RECOVER_MS - SHOT_MS;
}

/* ── Derived events ──────────────────────────────────────────────────────── */

export type EventType =
  | "Shot" | "Save" | "Goal" | "Card" | "Sub" | "Tackle";

export type DerivedEvent = {
  at: number; // real ms
  type: EventType;
  detail: string;
  xg?: number;
  isShot?: boolean;
  priceStep?: number;
  impulse?: number;
  scores?: boolean;
};

/** Built from BEATS at module load, so a feed row can never describe something
 *  the pitch isn't doing. */
export const EVENTS: DerivedEvent[] = (() => {
  const out: DerivedEvent[] = [];

  BEATS.forEach((beat, i) => {
    const next = BEATS[i + 1];

    if (beat.note) {
      out.push({
        at: realTimeOf(beat.at), type: beat.note.type,
        detail: beat.note.detail, impulse: 6,
      });
    }

    if (beat.via === "tackle") {
      out.push({
        at: realTimeOf(beat.at), type: "Tackle",
        detail: `${nameOf(beat.team, beat.idx)} wins it back`,
        impulse: beat.team === "home" ? 15 : -15,
      });
    }

    if (beat.action === "shot" && beat.shot && next) {
      const { outcome, xg, note, priceStep } = beat.shot;
      const contact = shotFireTime(beat, next) + SHOT_MS;
      const shooter = nameOf(beat.team, beat.idx);
      const home = beat.team === "home";

      if (outcome === "goal") {
        out.push({
          at: realTimeOf(contact), type: "Goal",
          detail: `${shooter} · ${note}`, xg, isShot: true,
          priceStep, impulse: 50, scores: true,
        });
      } else if (outcome === "saved") {
        out.push({
          at: realTimeOf(contact), type: "Save",
          detail: `${nameOf(next.team, next.idx)} · ${note}`, xg, isShot: true,
          priceStep, impulse: home ? 26 : -22,
        });
      } else {
        out.push({
          at: realTimeOf(contact), type: "Shot",
          detail: `${shooter} · ${note}`, xg, isShot: true,
          priceStep, impulse: home ? 20 : -16,
        });
      }
    }

    if (beat.action === "foul" && beat.foulBy && next) {
      out.push({
        at: realTimeOf(next.at), type: "Card",
        detail: `${nameOf(beat.foulBy.team, beat.foulBy.idx)} · ${beat.foulBy.reason}`,
        impulse: beat.foulBy.team === "away" ? 12 : -12,
      });
    }
  });

  return out.sort((a, b) => a.at - b.at);
})();

const FOUL_BEAT = BEATS.find((b) => b.action === "foul")!;
const GOAL_BEATS = BEATS.filter((b) => b.shot?.outcome === "goal");

/* ── Formations and per-player character ─────────────────────────────────── */

const HOME_SHAPE: [number, number][] = [
  [6, 50],
  [19, 18], [19, 40], [19, 60], [19, 82],
  [36, 28], [36, 50], [36, 72],
  [55, 20], [55, 50], [55, 80],
];

const AWAY_SHAPE: [number, number][] = [
  [94, 50],
  [81, 18], [81, 40], [81, 60], [81, 82],
  [64, 28], [64, 50], [64, 72],
  [45, 24], [45, 50], [45, 76],
];

type Role = "GK" | "CB" | "FB" | "CM" | "WING" | "ST";
const ROLES: Role[] = [
  "GK", "FB", "CB", "CB", "FB", "CM", "CM", "CM", "WING", "ST", "WING",
];

const ROLE_MOTION: Record<
  Role,
  { ax: number; ay: number; freq: number; burst: number; shift: number }
> = {
  GK: { ax: 1.1, ay: 2.6, freq: 0.22, burst: 0, shift: 0.15 },
  CB: { ax: 2.6, ay: 2.2, freq: 0.38, burst: 0, shift: 0.75 },
  FB: { ax: 4.8, ay: 5.8, freq: 0.5, burst: 2.5, shift: 1.05 },
  CM: { ax: 5.4, ay: 5.0, freq: 0.6, burst: 1, shift: 1 },
  WING: { ax: 7.8, ay: 4.2, freq: 0.72, burst: 4.5, shift: 1.15 },
  ST: { ax: 6.2, ay: 6.6, freq: 0.85, burst: 4, shift: 1.1 },
};

function hash(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function character(team: Team, i: number) {
  const salt = team === "home" ? 0 : 7;
  return {
    speed: 0.72 + hash(i, salt + 1) * 0.66,
    amp: 0.82 + hash(i, salt + 2) * 0.45,
    phase1: hash(i, salt + 3) * Math.PI * 2,
    phase2: hash(i, salt + 4) * Math.PI * 2,
    freq2: 1.55 + hash(i, salt + 5) * 1.0,
    burstPhase: hash(i, salt + 6) * Math.PI * 2,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function shapeFor(team: Team): [number, number][] {
  return team === "home" ? HOME_SHAPE : AWAY_SHAPE;
}

function focusAt(playTime: number): { x: number; y: number } {
  const { beat, next } = beatAt(playTime);
  const a = shapeFor(beat.team)[beat.idx];
  const b = shapeFor(next.team)[next.idx];
  const span = next.at - beat.at || 1;
  const p = clamp((playTime - beat.at) / span, 0, 1);
  const eased = p * p * (3 - 2 * p);
  return { x: a[0] + (b[0] - a[0]) * eased, y: a[1] + (b[1] - a[1]) * eased };
}

function playersAt(t: number, team: Team): { x: number; y: number }[] {
  const playTime = playClockAt(t);
  const settle = settleAt(t);
  const liveness = livenessAt(t);
  const focus = focusAt(playTime);
  const shape = shapeFor(team);
  const s = playTime / 1000;
  const attack = team === "home" ? 1 : -1;

  const blockX = (focus.x - 50) * (team === "home" ? 0.3 : 0.26) * settle;
  const blockY = (focus.y - 50) * (team === "home" ? 0.2 : 0.17) * settle;

  return shape.map(([bx, by], i) => {
    const motion = ROLE_MOTION[ROLES[i]];
    const c = character(team, i);
    const energy = settle * liveness * c.amp;
    const w1 = s * motion.freq * c.speed;
    const w2 = s * motion.freq * c.freq2 * c.speed;

    const driftX =
      (Math.sin(w1 + c.phase1) * 0.68 + Math.sin(w2 + c.phase2) * 0.34) *
      motion.ax * energy;
    const driftY =
      (Math.cos(w1 * 0.93 + c.phase2) * 0.68 +
        Math.sin(w2 * 1.08 + c.phase1) * 0.32) *
      motion.ay * energy;

    const burstWave = Math.sin(s * 0.34 * c.speed + c.burstPhase);
    const burst =
      motion.burst * Math.pow(Math.max(0, burstWave), 3) * attack * energy;

    return {
      x: clamp(bx + blockX * motion.shift + driftX + burst, 2.5, 97.5),
      y: clamp(by + blockY * motion.shift + driftY, 4, 96),
    };
  });
}

/* ── Ball ────────────────────────────────────────────────────────────────── */

const CENTRE = { x: 50, y: 50 };
const GOAL_MOUTH = { x: 98, y: 50 };

type Point = { x: number; y: number };

function lerp(a: Point, b: Point, p: number): Point {
  return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
}

/** Control point for a bent flight path — how a curled or dinked finish is
 *  drawn, and exactly the path the ball follows. */
export function controlPoint(a: Point, b: Point, bend: number): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: (a.x + b.x) / 2 + (-dy / len) * bend,
    y: (a.y + b.y) / 2 + (dx / len) * bend,
  };
}

function quadratic(a: Point, c: Point, b: Point, p: number): Point {
  const q = 1 - p;
  return {
    x: q * q * a.x + 2 * q * p * c.x + p * p * b.x,
    y: q * q * a.y + 2 * q * p * c.y + p * p * b.y,
  };
}

function shotEndPoint(beat: Beat, collector: Point): Point {
  const outcome = beat.shot!.outcome;
  if (outcome === "goal") return GOAL_MOUTH;
  if (outcome === "off") {
    return beat.team === "home" ? { x: 99, y: 24 } : { x: 1, y: 76 };
  }
  return collector;
}

type BallState = { x: number; y: number; inFlight: boolean };

function ballDuringPlay(
  playTime: number,
  home: Point[],
  away: Point[],
): BallState {
  const { beat, next } = beatAt(playTime);
  const pos = (b: Beat) => (b.team === "home" ? home : away)[b.idx];
  const holder = pos(beat);
  const receiver = pos(next);

  if (beat.action === "foul") return { ...holder, inFlight: false };

  if (beat.action === "shot" && beat.shot) {
    const fireAt = shotFireTime(beat, next);
    if (playTime < fireAt) return { ...holder, inFlight: false };

    const end = shotEndPoint(beat, receiver);
    const flight = clamp((playTime - fireAt) / SHOT_MS, 0, 1);

    if (flight < 1) {
      const bend = beat.shot.bend ?? 0;
      const point = bend
        ? quadratic(holder, controlPoint(holder, end, bend), end, flight)
        : lerp(holder, end, flight);
      return { ...point, inFlight: true };
    }
    if (beat.shot.outcome === "goal") return { ...end, inFlight: false };

    const recover = clamp((playTime - (fireAt + SHOT_MS)) / RECOVER_MS, 0, 1);
    return { ...lerp(end, receiver, recover), inFlight: recover < 1 };
  }

  const flightStart = next.at - PASS_FLIGHT_MS;
  if (playTime < flightStart) return { ...holder, inFlight: false };
  const p = clamp((playTime - flightStart) / PASS_FLIGHT_MS, 0, 1);
  return { ...lerp(holder, receiver, 1 - Math.pow(1 - p, 2)), inFlight: true };
}

export function ballAt(t: number): BallState {
  const phase = phaseAt(t);
  if (phase === "kickoff" || phase === "set") return { ...CENTRE, inFlight: false };
  if (phase === "slowmo") return { ...GOAL_MOUTH, inFlight: false };
  if (phase === "walkback") {
    const act = actAt(t);
    const from = act.goalAt + act.slowmoMs;
    const p = clamp((t - from) / (act.walkbackEnd - from), 0, 1);
    return { ...lerp(GOAL_MOUTH, CENTRE, p * p * (3 - 2 * p)), inFlight: false };
  }
  return ballDuringPlay(playClockAt(t), playersAt(t, "home"), playersAt(t, "away"));
}

/* ── Price and momentum ──────────────────────────────────────────────────── */

const BASE_PRICE = 4.82;

function eventsBefore(t: number): DerivedEvent[] {
  return EVENTS.filter((e) => e.at <= t);
}

function wobble(t: number): number {
  const s = t / 1000;
  return (
    Math.sin(s * 0.9) * 0.018 +
    Math.sin(s * 2.3 + 1.2) * 0.011 +
    Math.sin(s * 0.37 + 0.6) * 0.014
  );
}

export function priceAt(t: number): number {
  const stepped = eventsBefore(t).reduce((a, e) => a + (e.priceStep ?? 0), 0);
  return BASE_PRICE + stepped + wobble(t);
}

export const MOMENTUM_BARS = 30;
const MOMENTUM_SLICE_MS = LOOP_MS / MOMENTUM_BARS;

function momentumAt(t: number): number {
  const s = t / 1000;
  let value = Math.sin(s * 0.24) * 22 + Math.sin(s * 0.1 + 2) * 12;
  for (const e of EVENTS) {
    if (e.at > t || !e.impulse) continue;
    value += e.impulse * Math.exp(-(t - e.at) / 5000);
  }
  return clamp(value, -96, 96);
}

export type MomentumBar = { value: number; revealed: boolean; current: boolean };

/* ── State ───────────────────────────────────────────────────────────────── */

export type ShotLine = {
  x1: number; y1: number; x2: number; y2: number;
  /** Quadratic control point — equals the midpoint when the shot is straight. */
  cx: number; cy: number;
  outcome: ShotOutcome;
  xg: number;
  strength: number;
};

export type MatchState = {
  phase: Phase;
  clock: string;
  homeScore: number;
  awayScore: number;
  shots: number;
  xg: number;
  passes: number;
  possession: number;
  ball: BallState;
  ballTrail: Point[];
  homePlayers: Point[];
  awayPlayers: Point[];
  holder: { team: Team; idx: number } | null;
  tackle: { team: Team; idx: number } | null;
  feed: { minute: string; type: EventType; detail: string; xg?: number }[];
  momentum: MomentumBar[];
  momentumLeader: string;
  shotLine: ShotLine | null;
  card: { x: number; y: number; colour: "yellow" | "red" } | null;
  goalBadge: { scorer: string; minute: string; score: string; note: string } | null;
  netFlash: boolean;
  price: number;
  priceDelta: number;
  cause: { label: string; minute: string } | null;
  candleIndex: number;
};

const SHOT_FADE_MS = 400;
const TACKLE_FLASH_MS = 700;

function minuteAt(t: number): string {
  const second = MATCH_START_SECOND + (playClockAt(t) / 1000) * MATCH_SPEED;
  return `${Math.floor(second / 60)}'`;
}

function formatClock(t: number): string {
  const second = MATCH_START_SECOND + (playClockAt(t) / 1000) * MATCH_SPEED;
  const m = Math.floor(second / 60);
  const s = Math.floor(second % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const CANDLE_COUNT = 16;
const CANDLE_MS = LOOP_MS / CANDLE_COUNT;

export function matchStateAt(rawT: number): MatchState {
  const t = ((rawT % LOOP_MS) + LOOP_MS) % LOOP_MS;
  const phase = phaseAt(t);
  const playTime = playClockAt(t);
  const past = eventsBefore(t);

  const homePlayers = playersAt(t, "home");
  const awayPlayers = playersAt(t, "away");
  const ball = ballAt(t);

  const ballTrail =
    phase === "kickoff" || phase === "set"
      ? []
      : [90, 190, 300].map((back) => {
          const p = ballAt(Math.max(0, t - back));
          return { x: p.x, y: p.y };
        });

  const inPlay = phase === "play" || phase === "stoppage";
  const { beat, next } = beatAt(playTime);

  const holder = inPlay ? { team: beat.team, idx: beat.idx } : null;
  const tackle =
    inPlay && beat.via === "tackle" && playTime - beat.at < TACKLE_FLASH_MS
      ? { team: beat.team, idx: beat.idx }
      : null;

  /* Shot line — from the beat currently taking the shot, so it exists exactly
     while the ball is travelling it, along the same curve. */
  let shotLine: ShotLine | null = null;
  if (inPlay && beat.action === "shot" && beat.shot) {
    const fireAt = shotFireTime(beat, next);
    const since = playTime - fireAt;
    if (since >= 0 && since < SHOT_MS + SHOT_FADE_MS) {
      const origin = (beat.team === "home" ? homePlayers : awayPlayers)[beat.idx];
      const collector = (next.team === "home" ? homePlayers : awayPlayers)[next.idx];
      const end = shotEndPoint(beat, collector);
      const c = controlPoint(origin, end, beat.shot.bend ?? 0);
      shotLine = {
        x1: origin.x, y1: origin.y, x2: end.x, y2: end.y, cx: c.x, cy: c.y,
        outcome: beat.shot.outcome, xg: beat.shot.xg,
        strength: since <= SHOT_MS ? 1 : 1 - (since - SHOT_MS) / SHOT_FADE_MS,
      };
    }
  }

  const act = actAt(t);
  const scored = ACTS.filter((a) => t >= a.goalAt).length;
  const currentGoalBeat = GOAL_BEATS[ACTS.indexOf(act)];

  // Hold the goal's line through the slow-motion replay — that's what makes the
  // replay worth watching.
  if (phase === "slowmo" && currentGoalBeat?.shot) {
    const origin = playersAt(realTimeOf(currentGoalBeat.at), currentGoalBeat.team)[
      currentGoalBeat.idx
    ];
    const c = controlPoint(origin, GOAL_MOUTH, currentGoalBeat.shot.bend ?? 0);
    shotLine = {
      x1: origin.x, y1: origin.y, x2: GOAL_MOUTH.x, y2: GOAL_MOUTH.y,
      cx: c.x, cy: c.y, outcome: "goal", xg: currentGoalBeat.shot.xg, strength: 1,
    };
  }

  let card: MatchState["card"] = null;
  const stoppage = ACTS.find((a) => a.stoppage)?.stoppage;
  if (stoppage && t >= stoppage[0] && t < stoppage[1] + 1_200 && FOUL_BEAT.foulBy) {
    const offender = (FOUL_BEAT.foulBy.team === "home" ? homePlayers : awayPlayers)[
      FOUL_BEAT.foulBy.idx
    ];
    card = { x: offender.x, y: offender.y, colour: FOUL_BEAT.foulBy.card };
  }

  const inCelebration = t >= act.goalAt && t < act.walkbackEnd;
  const goalBadge =
    inCelebration && currentGoalBeat?.shot
      ? {
          scorer: nameOf(currentGoalBeat.team, currentGoalBeat.idx),
          minute: minuteAt(act.goalAt),
          score: `${1 + scored}–1`,
          note: currentGoalBeat.shot.note,
        }
      : null;

  const currentSlice = Math.floor(t / MOMENTUM_SLICE_MS);
  const momentum: MomentumBar[] = Array.from(
    { length: MOMENTUM_BARS },
    (_, i) => ({
      value: momentumAt((i + 0.5) * MOMENTUM_SLICE_MS),
      revealed: i <= currentSlice,
      current: i === currentSlice,
    }),
  );

  const price = priceAt(t);
  const lastPriceEvent = [...past].reverse().find((e) => e.priceStep);
  const nowMomentum = momentum[currentSlice]?.value ?? 0;

  return {
    phase,
    clock: formatClock(t),
    homeScore: 1 + scored,
    awayScore: 1,
    shots: 11 + past.filter((e) => e.isShot).length,
    xg: Number((1.21 + past.reduce((a, e) => a + (e.xg ?? 0), 0)).toFixed(2)),
    passes: 431 + Math.floor(playTime / 620),
    possession: Math.round(58 + Math.sin(playTime / 9000) * 5),
    ball,
    ballTrail,
    homePlayers,
    awayPlayers,
    holder,
    tackle,
    feed: [...past].reverse().slice(0, 6).map((e) => ({
      minute: minuteAt(e.at),
      type: e.type,
      detail: e.detail,
      xg: e.xg,
    })),
    momentum,
    momentumLeader: nowMomentum >= 0 ? HOME.name : AWAY.name,
    shotLine,
    card,
    goalBadge,
    netFlash: ACTS.some((a) => t >= a.goalAt && t < a.goalAt + 1_400),
    price,
    priceDelta: price - BASE_PRICE,
    cause: lastPriceEvent
      ? {
          label: `${lastPriceEvent.type} · ${lastPriceEvent.detail}`,
          minute: minuteAt(lastPriceEvent.at),
        }
      : null,
    candleIndex: Math.floor(t / CANDLE_MS),
  };
}

/* ── Candles ─────────────────────────────────────────────────────────────── */

export type Candle = {
  open: number; close: number; high: number; low: number;
  live: boolean; spike: boolean;
};

export function candlesAt(rawT: number): Candle[] {
  const t = ((rawT % LOOP_MS) + LOOP_MS) % LOOP_MS;
  const current = Math.floor(t / CANDLE_MS);

  return Array.from({ length: CANDLE_COUNT }, (_, i) => {
    if (i > current) {
      return { open: NaN, close: NaN, high: NaN, low: NaN, live: false, spike: false };
    }
    const startMs = i * CANDLE_MS;
    const endMs = (i + 1) * CANDLE_MS;
    const isLive = i === current;
    const open = priceAt(startMs);
    const close = isLive ? priceAt(t) : priceAt(endMs);

    const samples: number[] = [];
    const limit = isLive ? t : endMs;
    for (let ms = startMs; ms <= limit; ms += CANDLE_MS / 6) samples.push(priceAt(ms));
    if (samples.length === 0) samples.push(open);

    return {
      open,
      close,
      high: Math.max(...samples, open, close),
      low: Math.min(...samples, open, close),
      live: isLive,
      spike: EVENTS.some((e) => e.scores && e.at >= startMs && e.at < endMs),
    };
  });
}
