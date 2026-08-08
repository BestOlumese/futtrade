/**
 * The landing page's scripted match — ONE event stream driving every animated
 * surface on the page.
 *
 * AGENTS.md: "One event stream powers everything downstream: the live 2D viewer,
 * post-match stats, player Form and market price movement. Get that schema
 * right; treat it as the spine of the whole system."
 *
 * ── Why this file is shaped the way it is ──────────────────────────────────
 *
 * An earlier version kept possession and events as TWO independent schedules.
 * They inevitably drifted: a shot fired in the feed while the ball was across
 * the pitch with somebody else, so the shot line appeared before the shot. That
 * is exactly the second data path AGENTS.md warns against.
 *
 * There is now a single ordered list of BEATS. A beat says who has the ball and
 * what happens as it leaves — pass, shot, or foul. Everything else is derived
 * from it: the ball's position, the shot line, the tackle flash, the feed rows,
 * the stats, the momentum impulses and the share price. The line and the ball
 * cannot disagree because they are computed from the same record.
 *
 * ── Two clocks ────────────────────────────────────────────────────────────
 *
 * Real loop time advances continuously. PLAY time freezes during the booking
 * and crawls during the slow-motion goal. `playClockAt` maps real → play and
 * `realTimeOf` inverts it. Beats live in play time; phases and the price live
 * in real time.
 *
 * `matchStateAt` is pure, so server and client render identically, a section
 * scrolled back into view is instantly in sync, and state at LOOP_MS equals
 * state at 0 — the loop closes on the kickoff.
 *
 * None of this is real data, and it is deliberately not wired to a live match:
 * the landing page has to work when nothing is in progress.
 */

export const LOOP_MS = 72_000;

const MATCH_SPEED = 12; // match seconds per second of PLAY time
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

/* ── Phase schedule, real loop ms ────────────────────────────────────────── */

const T_KICKOFF_END = 3_000;
const T_CARD = 40_000;
const T_CARD_END = 42_000;
const T_GOAL = 56_000;
const T_SLOWMO_END = 59_000;
const T_WALKBACK_END = 66_000;

export type Phase =
  | "kickoff" | "play" | "stoppage" | "slowmo" | "walkback" | "set";

export function phaseAt(t: number): Phase {
  if (t < T_KICKOFF_END) return "kickoff";
  if (t < T_CARD) return "play";
  if (t < T_CARD_END) return "stoppage";
  if (t < T_GOAL) return "play";
  if (t < T_SLOWMO_END) return "slowmo";
  if (t < T_WALKBACK_END) return "walkback";
  return "set";
}

const SLOWMO_RATE = 0.1;
const PLAY_BEFORE_CARD = T_CARD - T_KICKOFF_END; // 37_000
export const PLAY_TOTAL = PLAY_BEFORE_CARD + (T_GOAL - T_CARD_END); // 51_000

export function playClockAt(t: number): number {
  if (t <= T_KICKOFF_END) return 0;
  if (t <= T_CARD) return t - T_KICKOFF_END;
  if (t <= T_CARD_END) return PLAY_BEFORE_CARD;
  if (t <= T_GOAL) return PLAY_BEFORE_CARD + (t - T_CARD_END);
  if (t <= T_SLOWMO_END) return PLAY_TOTAL + (t - T_GOAL) * SLOWMO_RATE;
  return PLAY_TOTAL + (T_SLOWMO_END - T_GOAL) * SLOWMO_RATE;
}

/** Inverse of playClockAt. At the stoppage it returns the moment play STOPPED,
 *  which is when the foul happened — the useful answer for scheduling. */
export function realTimeOf(playTime: number): number {
  if (playTime <= 0) return T_KICKOFF_END;
  if (playTime <= PLAY_BEFORE_CARD) return T_KICKOFF_END + playTime;
  if (playTime <= PLAY_TOTAL) return T_CARD_END + (playTime - PLAY_BEFORE_CARD);
  return T_GOAL + (playTime - PLAY_TOTAL) / SLOWMO_RATE;
}

const SETTLE_RAMP_START = 1_500;
const SETTLE_RAMP_END = 4_500;

function settleAt(t: number): number {
  if (t < SETTLE_RAMP_START) return 0;
  if (t < SETTLE_RAMP_END) {
    return (t - SETTLE_RAMP_START) / (SETTLE_RAMP_END - SETTLE_RAMP_START);
  }
  if (t < T_SLOWMO_END) return 1;
  if (t < T_WALKBACK_END) {
    return 1 - (t - T_SLOWMO_END) / (T_WALKBACK_END - T_SLOWMO_END);
  }
  return 0;
}

function livenessAt(t: number): number {
  const phase = phaseAt(t);
  if (phase === "stoppage") return 0.12;
  if (phase === "slowmo") return 0.06;
  if (phase === "walkback") return 0.5;
  return 1;
}

/* ── The beat list: the single source of truth ───────────────────────────── */

export type ShotOutcome = "goal" | "saved" | "blocked" | "off";
export type Arrival =
  | "kickoff" | "pass" | "tackle" | "save" | "block" | "goalkick" | "freekick" | "goal";

type Beat = {
  /** Play-time ms at which this player GAINS the ball. */
  at: number;
  team: Team;
  idx: number;
  via: Arrival;
  /** What they do with it as the beat ends. */
  action: "pass" | "shot" | "foul";
  shot?: { outcome: ShotOutcome; xg: number; note: string };
  /** Foul committed on this carrier, by the named opponent. */
  foulBy?: { team: Team; idx: number; card: "yellow" | "red"; reason: string };
  /** A non-possession note emitted when this beat starts. */
  note?: { type: "Sub"; detail: string };
};

const SHOT_MS = 450;
const RECOVER_MS = 750;
const PASS_FLIGHT_MS = 600;

/**
 * The passage. The foul must land on PLAY_BEFORE_CARD and the goal on
 * PLAY_TOTAL, because those are the play-time coordinates of the scripted
 * stoppage and slow-motion phases.
 */
const BEATS: Beat[] = [
  { at: 0, team: "home", idx: 6, via: "kickoff", action: "pass" },
  { at: 2_200, team: "home", idx: 2, via: "pass", action: "pass" },
  { at: 4_200, team: "away", idx: 8, via: "tackle", action: "pass" },
  { at: 6_000, team: "home", idx: 5, via: "tackle", action: "pass" },
  { at: 8_200, team: "home", idx: 6, via: "pass", action: "pass" },
  {
    at: 10_000, team: "home", idx: 8, via: "pass", action: "shot",
    shot: { outcome: "blocked", xg: 0.09, note: "blocked" },
  },
  { at: 12_500, team: "away", idx: 3, via: "block", action: "pass" },
  { at: 14_500, team: "away", idx: 6, via: "pass", action: "pass" },
  {
    at: 16_500, team: "away", idx: 9, via: "pass", action: "shot",
    shot: { outcome: "saved", xg: 0.31, note: "low to the right" },
  },
  { at: 19_000, team: "home", idx: 0, via: "save", action: "pass" },
  { at: 21_500, team: "home", idx: 3, via: "pass", action: "pass" },
  {
    at: 24_000, team: "home", idx: 7, via: "pass", action: "pass",
    note: { type: "Sub", detail: "Renn on for Kavan" },
  },
  { at: 27_000, team: "home", idx: 5, via: "pass", action: "pass" },
  { at: 29_500, team: "home", idx: 6, via: "pass", action: "pass" },
  { at: 32_000, team: "home", idx: 9, via: "pass", action: "pass" },
  {
    at: 34_500, team: "home", idx: 7, via: "pass", action: "foul",
    foulBy: { team: "away", idx: 5, card: "yellow", reason: "dissent" },
  },
  // Free kick from the same spot, taken by the player who was fouled — so the
  // ball never teleports across the stoppage.
  { at: PLAY_BEFORE_CARD, team: "home", idx: 7, via: "freekick", action: "pass" },
  { at: 39_500, team: "home", idx: 8, via: "pass", action: "pass" },
  {
    at: 41_500, team: "home", idx: 9, via: "pass", action: "shot",
    shot: { outcome: "off", xg: 0.12, note: "over" },
  },
  { at: 44_000, team: "away", idx: 0, via: "goalkick", action: "pass" },
  { at: 46_500, team: "away", idx: 5, via: "pass", action: "pass" },
  {
    at: 48_200, team: "home", idx: 9, via: "tackle", action: "shot",
    shot: { outcome: "goal", xg: 0.44, note: "left foot" },
  },
  { at: PLAY_TOTAL, team: "home", idx: 9, via: "goal", action: "pass" },
];

function beatAt(playTime: number) {
  let i = 0;
  for (let k = 0; k < BEATS.length - 1; k++) {
    if (BEATS[k].at <= playTime) i = k;
  }
  return { beat: BEATS[i], next: BEATS[i + 1] ?? BEATS[0], index: i };
}

/** When a shot leaves the boot, in play time. */
function shotFireTime(beat: Beat, next: Beat): number {
  return beat.shot?.outcome === "goal"
    ? next.at - SHOT_MS
    : next.at - RECOVER_MS - SHOT_MS;
}

/* ── Derived events: feed rows, price steps, momentum impulses ───────────── */

export type EventType =
  | "Shot" | "Save" | "Goal" | "Card" | "Sub" | "Tackle" | "Foul";

export type DerivedEvent = {
  /** Real loop ms. */
  at: number;
  type: EventType;
  detail: string;
  xg?: number;
  isShot?: boolean;
  priceStep?: number;
  impulse?: number;
  scores?: boolean;
};

/** Built once from BEATS, so a feed row can never describe something the pitch
 *  isn't doing. */
export const EVENTS: DerivedEvent[] = (() => {
  const out: DerivedEvent[] = [];

  BEATS.forEach((beat, i) => {
    const next = BEATS[i + 1];

    if (beat.note) {
      out.push({
        at: realTimeOf(beat.at),
        type: beat.note.type,
        detail: beat.note.detail,
        impulse: 6,
      });
    }

    if (beat.via === "tackle") {
      out.push({
        at: realTimeOf(beat.at),
        type: "Tackle",
        detail: `${nameOf(beat.team, beat.idx)} wins it back`,
        impulse: beat.team === "home" ? 15 : -15,
      });
    }

    if (beat.action === "shot" && beat.shot && next) {
      const { outcome, xg, note } = beat.shot;
      const contact = shotFireTime(beat, next) + SHOT_MS;
      const shooter = nameOf(beat.team, beat.idx);
      const home = beat.team === "home";

      if (outcome === "goal") {
        out.push({
          at: realTimeOf(contact), type: "Goal",
          detail: `${shooter} · ${note}`, xg, isShot: true,
          priceStep: 0.27, impulse: 48, scores: true,
        });
      } else if (outcome === "saved") {
        // Credited to the keeper who made it — the next beat's player.
        out.push({
          at: realTimeOf(contact), type: "Save",
          detail: `${nameOf(next.team, next.idx)} · ${note}`, xg, isShot: true,
          priceStep: home ? 0.05 : 0, impulse: home ? 26 : -20,
        });
      } else {
        out.push({
          at: realTimeOf(contact), type: "Shot",
          detail: `${shooter} · ${note}`, xg, isShot: true,
          priceStep: home ? (outcome === "off" ? 0.04 : 0.02) : 0,
          impulse: home ? 20 : -16,
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

/** Where play is focused, from BASE positions only — the block shift derives
 *  from this and the ball derives from the shifted players, so live positions
 *  here would be circular. */
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

function lerp(
  a: { x: number; y: number },
  b: { x: number; y: number },
  p: number,
) {
  return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
}

/** Where a shot ends up. For saves and blocks this is the collector's own
 *  position, which is what keeps the drawn line and the ball identical. */
function shotEndPoint(
  beat: Beat,
  collector: { x: number; y: number },
): { x: number; y: number } {
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
  home: { x: number; y: number }[],
  away: { x: number; y: number }[],
): BallState {
  const { beat, next } = beatAt(playTime);
  const pos = (b: Beat) => (b.team === "home" ? home : away)[b.idx];
  const holder = pos(beat);
  const receiver = pos(next);

  if (beat.action === "foul") {
    // Ball is dead at the offence, and the free kick is taken from the same
    // spot by the same player — so it never jumps.
    return { ...holder, inFlight: false };
  }

  if (beat.action === "shot" && beat.shot) {
    const fireAt = shotFireTime(beat, next);
    if (playTime < fireAt) return { ...holder, inFlight: false };

    const end = shotEndPoint(beat, receiver);
    const flight = clamp((playTime - fireAt) / SHOT_MS, 0, 1);

    if (flight < 1) {
      return { ...lerp(holder, end, flight), inFlight: true };
    }
    if (beat.shot.outcome === "goal") {
      return { ...end, inFlight: false };
    }
    // Recovery: the ball is gathered by whoever collects it.
    const recover = clamp(
      (playTime - (fireAt + SHOT_MS)) / RECOVER_MS,
      0,
      1,
    );
    return { ...lerp(end, receiver, recover), inFlight: recover < 1 };
  }

  const flightStart = next.at - PASS_FLIGHT_MS;
  if (playTime < flightStart) return { ...holder, inFlight: false };
  const p = clamp((playTime - flightStart) / PASS_FLIGHT_MS, 0, 1);
  return { ...lerp(holder, receiver, 1 - Math.pow(1 - p, 2)), inFlight: true };
}

export function ballAt(t: number): BallState {
  const phase = phaseAt(t);
  if (phase === "kickoff" || phase === "set") {
    return { ...CENTRE, inFlight: false };
  }
  if (phase === "slowmo") return { ...GOAL_MOUTH, inFlight: false };
  if (phase === "walkback") {
    const p = clamp((t - T_SLOWMO_END) / (T_WALKBACK_END - T_SLOWMO_END), 0, 1);
    return { ...lerp(GOAL_MOUTH, CENTRE, p * p * (3 - 2 * p)), inFlight: false };
  }
  return ballDuringPlay(
    playClockAt(t),
    playersAt(t, "home"),
    playersAt(t, "away"),
  );
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

export const MOMENTUM_BARS = 26;
const MOMENTUM_SLICE_MS = LOOP_MS / MOMENTUM_BARS;

function momentumAt(t: number): number {
  const s = t / 1000;
  let value = Math.sin(s * 0.3) * 24 + Math.sin(s * 0.12 + 2) * 13;
  for (const e of EVENTS) {
    if (e.at > t || !e.impulse) continue;
    value += e.impulse * Math.exp(-(t - e.at) / 4500);
  }
  return clamp(value, -96, 96);
}

export type MomentumBar = { value: number; revealed: boolean; current: boolean };

/* ── State ───────────────────────────────────────────────────────────────── */

export type ShotLine = {
  x1: number; y1: number; x2: number; y2: number;
  outcome: ShotOutcome;
  xg: number;
  /** 1 while in flight, decaying to 0 after contact. */
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
  ballTrail: { x: number; y: number }[];
  homePlayers: { x: number; y: number }[];
  awayPlayers: { x: number; y: number }[];
  holder: { team: Team; idx: number } | null;
  /** Set briefly when possession flips through a challenge. */
  tackle: { team: Team; idx: number } | null;
  feed: { minute: string; type: EventType; detail: string; xg?: number }[];
  momentum: MomentumBar[];
  momentumLeader: string;
  shotLine: ShotLine | null;
  card: { x: number; y: number; colour: "yellow" | "red" } | null;
  goalBadge: { scorer: string; minute: string; score: string } | null;
  netFlash: boolean;
  price: number;
  priceDelta: number;
  cause: { label: string; minute: string } | null;
  candleIndex: number;
};

const SHOT_FADE_MS = 400;
const TACKLE_FLASH_MS = 700;
const GOAL_BADGE_MS = 8_000;

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

export const CANDLE_COUNT = 12;
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

  // Tackle flash: possession has just flipped through a challenge.
  const tackle =
    inPlay && beat.via === "tackle" && playTime - beat.at < TACKLE_FLASH_MS
      ? { team: beat.team, idx: beat.idx }
      : null;

  /* Shot line — derived from the beat currently taking the shot, so the line
     exists exactly while the ball is travelling it. */
  let shotLine: ShotLine | null = null;
  if (beat.action === "shot" && beat.shot) {
    const fireAt = shotFireTime(beat, next);
    const since = playTime - fireAt;
    if (since >= 0 && since < SHOT_MS + SHOT_FADE_MS) {
      const origin = (beat.team === "home" ? homePlayers : awayPlayers)[beat.idx];
      const collector = (next.team === "home" ? homePlayers : awayPlayers)[next.idx];
      const end = shotEndPoint(beat, collector);
      shotLine = {
        x1: origin.x, y1: origin.y, x2: end.x, y2: end.y,
        outcome: beat.shot.outcome,
        xg: beat.shot.xg,
        strength:
          since <= SHOT_MS ? 1 : 1 - (since - SHOT_MS) / SHOT_FADE_MS,
      };
    }
  }
  // The goal's line is held through the slow-motion replay — that's what makes
  // the replay worth watching.
  if (phase === "slowmo") {
    const goalBeat = BEATS.find((b) => b.shot?.outcome === "goal")!;
    const origin = playersAt(realTimeOf(goalBeat.at), "home")[goalBeat.idx];
    shotLine = {
      x1: origin.x, y1: origin.y, x2: GOAL_MOUTH.x, y2: GOAL_MOUTH.y,
      outcome: "goal", xg: goalBeat.shot!.xg, strength: 1,
    };
  }

  // Card sits on the offender through the stoppage and a short beat after.
  let card: MatchState["card"] = null;
  if (t >= T_CARD && t < T_CARD_END + 1_200 && FOUL_BEAT.foulBy) {
    const offender = (FOUL_BEAT.foulBy.team === "home" ? homePlayers : awayPlayers)[
      FOUL_BEAT.foulBy.idx
    ];
    card = { x: offender.x, y: offender.y, colour: FOUL_BEAT.foulBy.card };
  }

  const scoring = past.filter((e) => e.scores).length;
  const goalBadge =
    t >= T_GOAL && t < T_GOAL + GOAL_BADGE_MS
      ? { scorer: TRACKED_PLAYER, minute: minuteAt(T_GOAL), score: `${1 + scoring}–1` }
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
    homeScore: 1 + scoring,
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
    netFlash: t >= T_GOAL && t < T_GOAL + 1_400,
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
