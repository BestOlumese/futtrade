/**
 * The landing page's scripted match — a single event stream that drives every
 * animated surface on the page.
 *
 * Mirrors the real architecture on purpose. AGENTS.md: "One event stream powers
 * everything downstream: the live 2D viewer, post-match stats, player Form and
 * market price movement."
 *
 * Two structural decisions worth knowing before editing:
 *
 * 1. POSSESSION DRIVES THE BALL, never the reverse. The script names who holds
 *    it and the ball's position is derived from that player's live position, so
 *    a pass always leaves a player and always arrives at one.
 *
 * 2. REAL TIME AND PLAY TIME ARE DIFFERENT CLOCKS. The passage contains a card
 *    stoppage, a slow-motion goal replay and a walk-back to kickoff, so play
 *    time freezes or crawls while the loop's real time keeps advancing.
 *    `playClockAt` is the mapping between them. The match clock, possession and
 *    player movement all read play time; phases and event scheduling read real
 *    time.
 *
 * `matchStateAt` is pure, so server and client render identically, a section
 * scrolled back into view is instantly in sync, and state at LOOP_MS equals
 * state at 0 — the loop closes on the kickoff, which is why the restart reads
 * as intentional rather than as a glitch.
 *
 * None of this is real data, and it is deliberately not wired to a live match:
 * the landing page has to work when nothing is in progress.
 */

export const LOOP_MS = 72_000;

/** Match seconds per second of PLAY time (stoppages excluded). */
const MATCH_SPEED = 12;
const MATCH_START_SECOND = 64 * 60 + 12;

export const HOME = { name: "Kestrel FC", short: "KES" };
export const AWAY = { name: "Ardor SC", short: "ARD" };
export const TRACKED_PLAYER = "A. Delane";

/* ── Phase schedule, in real loop ms ─────────────────────────────────────── */

const T_KICKOFF_END = 3_000; // ball on the centre spot, teams in shape
const T_CARD = 40_000; // card shown, play stops
const T_CARD_END = 42_000;
const T_GOAL = 56_000; // the climax
const T_SLOWMO_END = 59_000; // heavy slow-motion hold
const T_WALKBACK_END = 66_000; // players return to shape, ball to centre
// T_WALKBACK_END → LOOP_MS: set for kickoff. Identical to t=0, so the loop closes.

export type Phase = "kickoff" | "play" | "stoppage" | "slowmo" | "walkback" | "set";

export function phaseAt(t: number): Phase {
  if (t < T_KICKOFF_END) return "kickoff";
  if (t < T_CARD) return "play";
  if (t < T_CARD_END) return "stoppage";
  if (t < T_GOAL) return "play";
  if (t < T_SLOWMO_END) return "slowmo";
  if (t < T_WALKBACK_END) return "walkback";
  return "set";
}

/** Heavy slow-motion: play crawls to a near-freeze on the goal. */
const SLOWMO_RATE = 0.1;

const PLAY_BEFORE_CARD = T_CARD - T_KICKOFF_END;
const PLAY_TOTAL = PLAY_BEFORE_CARD + (T_GOAL - T_CARD_END);

/** Real loop time → play time. Frozen during stoppage, crawling in slow-mo. */
export function playClockAt(t: number): number {
  if (t <= T_KICKOFF_END) return 0;
  if (t <= T_CARD) return t - T_KICKOFF_END;
  if (t <= T_CARD_END) return PLAY_BEFORE_CARD;
  if (t <= T_GOAL) return PLAY_BEFORE_CARD + (t - T_CARD_END);
  if (t <= T_SLOWMO_END) return PLAY_TOTAL + (t - T_GOAL) * SLOWMO_RATE;
  return PLAY_TOTAL + (T_SLOWMO_END - T_GOAL) * SLOWMO_RATE;
}

/**
 * How "in play" the shape is. 0 means settled into base formation for kickoff,
 * 1 means full match movement. Ramps in after kickoff and out during walk-back,
 * which is what stops the reset from snapping.
 */
const SETTLE_RAMP_START = 1_500;
const SETTLE_RAMP_END = 4_500;

function settleAt(t: number): number {
  // Ramp in after the kickoff whistle…
  if (t < SETTLE_RAMP_START) return 0;
  if (t < SETTLE_RAMP_END) {
    return (t - SETTLE_RAMP_START) / (SETTLE_RAMP_END - SETTLE_RAMP_START);
  }
  if (t < T_SLOWMO_END) return 1;
  // …and back out as the players walk into shape for the restart.
  if (t < T_WALKBACK_END) {
    return 1 - (t - T_SLOWMO_END) / (T_WALKBACK_END - T_SLOWMO_END);
  }
  return 0;
}

/** Movement energy. Play stops for a card and nearly stops in slow-motion. */
function livenessAt(t: number): number {
  const phase = phaseAt(t);
  if (phase === "stoppage") return 0.12;
  if (phase === "slowmo") return 0.06;
  if (phase === "walkback") return 0.5;
  return 1;
}

/* ── Events ──────────────────────────────────────────────────────────────── */

export type EventType = "Shot" | "Save" | "Goal" | "Card" | "Sub" | "Tackle";
export type ShotOutcome = "goal" | "saved" | "blocked" | "off";
export type Team = "home" | "away";

export type MatchEvent = {
  /** Real loop ms. */
  at: number;
  type: EventType;
  detail: string;
  xg?: number;
  isShot?: boolean;
  priceStep?: number;
  impulse?: number;
  scores?: boolean;
  /** Who struck it — drives where the shot line is drawn from. */
  shooter?: { team: Team; idx: number };
  outcome?: ShotOutcome;
  card?: "yellow" | "red";
  cardOn?: { team: Team; idx: number };
};

export const EVENTS: MatchEvent[] = [
  { at: 6_000, type: "Tackle", detail: "Marek wins it back", impulse: 14 },
  {
    at: 13_000, type: "Shot", detail: "Orsi · blocked", xg: 0.09, isShot: true,
    priceStep: 0.02, impulse: 22, shooter: { team: "home", idx: 8 }, outcome: "blocked",
  },
  {
    at: 22_000, type: "Save", detail: "Voss · low to the right", xg: 0.31, isShot: true,
    priceStep: 0.05, impulse: -18, shooter: { team: "away", idx: 9 }, outcome: "saved",
  },
  { at: 31_000, type: "Sub", detail: "Renn on for Kavan", impulse: 6 },
  {
    at: T_CARD, type: "Card", detail: "Ardor SC · dissent", impulse: 10,
    card: "yellow", cardOn: { team: "away", idx: 5 },
  },
  {
    at: 48_000, type: "Shot", detail: `${TRACKED_PLAYER} · over`, xg: 0.12, isShot: true,
    priceStep: 0.04, impulse: 18, shooter: { team: "home", idx: 9 }, outcome: "off",
  },
  {
    at: T_GOAL, type: "Goal", detail: `${TRACKED_PLAYER} · left foot`, xg: 0.44,
    isShot: true, priceStep: 0.27, impulse: 48, scores: true,
    shooter: { team: "home", idx: 9 }, outcome: "goal",
  },
];

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

/**
 * Per-role movement envelope. This is what stops the pitch looking like a wave:
 * a keeper patrols a few percent of his line while a winger covers a quarter of
 * the pitch, and they do it at different speeds.
 */
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

/** Deterministic 0..1 from a player index and a salt — no RNG, no hydration risk. */
function hash(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Each player gets his own speed, amplitude and two unrelated rhythms. */
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

/* ── Possession ──────────────────────────────────────────────────────────── */

/** Possession chain over PLAY time (0 … PLAY_TOTAL). */
const POSSESSION: { at: number; team: Team; idx: number }[] = [
  { at: 0, team: "home", idx: 6 },
  { at: 2_000, team: "home", idx: 2 },
  { at: 4_000, team: "away", idx: 8 },
  { at: 5_500, team: "home", idx: 6 },
  { at: 8_000, team: "home", idx: 5 },
  { at: 9_500, team: "home", idx: 8 },
  { at: 11_500, team: "away", idx: 2 },
  { at: 14_000, team: "away", idx: 6 },
  { at: 17_000, team: "away", idx: 9 },
  { at: 19_500, team: "home", idx: 0 },
  { at: 22_000, team: "home", idx: 3 },
  { at: 25_000, team: "home", idx: 7 },
  { at: 28_000, team: "home", idx: 5 },
  { at: 31_000, team: "home", idx: 6 },
  { at: 34_000, team: "away", idx: 5 },
  { at: 37_000, team: "home", idx: 7 },
  { at: 40_000, team: "home", idx: 6 },
  { at: 43_000, team: "home", idx: 8 },
  { at: 45_000, team: "home", idx: 9 },
  { at: 47_500, team: "home", idx: 10 },
  { at: 49_500, team: "home", idx: 6 },
  { at: 51_000, team: "home", idx: 9 },
  { at: PLAY_TOTAL, team: "home", idx: 9 },
];

const PASS_FLIGHT_MS = 600;

function possessionAt(playTime: number) {
  let i = 0;
  for (let k = 0; k < POSSESSION.length - 1; k++) {
    if (POSSESSION[k].at <= playTime) i = k;
  }
  return {
    from: POSSESSION[i],
    to: POSSESSION[i + 1] ?? POSSESSION[0],
    startsAt: POSSESSION[i].at,
    endsAt: (POSSESSION[i + 1] ?? POSSESSION[0]).at,
  };
}

/** Where play is focused, from BASE positions only — the block shift is derived
 *  from this and the ball is derived from the shifted players, so using live
 *  positions here would be circular. */
function focusAt(playTime: number): { x: number; y: number } {
  const { from, to, startsAt, endsAt } = possessionAt(playTime);
  const a = shapeFor(from.team)[from.idx];
  const b = shapeFor(to.team)[to.idx];
  const span = endsAt - startsAt || 1;
  const p = clamp((playTime - startsAt) / span, 0, 1);
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
    const role = ROLES[i];
    const motion = ROLE_MOTION[role];
    const c = character(team, i);
    const energy = settle * liveness * c.amp;

    const w1 = s * motion.freq * c.speed;
    const w2 = s * motion.freq * c.freq2 * c.speed;

    const driftX =
      (Math.sin(w1 + c.phase1) * 0.68 + Math.sin(w2 + c.phase2) * 0.34) *
      motion.ax *
      energy;
    const driftY =
      (Math.cos(w1 * 0.93 + c.phase2) * 0.68 +
        Math.sin(w2 * 1.08 + c.phase1) * 0.32) *
      motion.ay *
      energy;

    // Bursts: attackers surge forward then drop off, rather than gliding.
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

/** Where the goal that was just scored sits, for the ball-in-net position. */
const GOAL_MOUTH = { x: 98, y: 50 };

function ballFromPossession(
  playTime: number,
  home: { x: number; y: number }[],
  away: { x: number; y: number }[],
): { x: number; y: number; inFlight: boolean } {
  const { from, to, endsAt } = possessionAt(playTime);
  const pick = (team: Team, idx: number) => (team === "home" ? home : away)[idx];
  const holder = pick(from.team, from.idx);
  const flightStart = endsAt - PASS_FLIGHT_MS;

  if (playTime < flightStart) {
    return { x: holder.x, y: holder.y, inFlight: false };
  }

  const receiver = pick(to.team, to.idx);
  const p = clamp((playTime - flightStart) / PASS_FLIGHT_MS, 0, 1);
  const eased = 1 - Math.pow(1 - p, 2);
  return {
    x: holder.x + (receiver.x - holder.x) * eased,
    y: holder.y + (receiver.y - holder.y) * eased,
    inFlight: true,
  };
}

export function ballAt(t: number): { x: number; y: number; inFlight: boolean } {
  const phase = phaseAt(t);

  if (phase === "kickoff" || phase === "set") {
    return { ...CENTRE, inFlight: false };
  }

  if (phase === "slowmo") {
    // Struck at T_GOAL and travelling into the net across the slow-motion hold.
    const shooter = playersAt(T_GOAL, "home")[9];
    const p = clamp((t - T_GOAL) / (T_SLOWMO_END - T_GOAL), 0, 1);
    const eased = Math.min(1, p * 2.2);
    return {
      x: shooter.x + (GOAL_MOUTH.x - shooter.x) * eased,
      y: shooter.y + (GOAL_MOUTH.y - shooter.y) * eased,
      inFlight: eased < 1,
    };
  }

  if (phase === "walkback") {
    const p = clamp((t - T_SLOWMO_END) / (T_WALKBACK_END - T_SLOWMO_END), 0, 1);
    const eased = p * p * (3 - 2 * p);
    return {
      x: GOAL_MOUTH.x + (CENTRE.x - GOAL_MOUTH.x) * eased,
      y: GOAL_MOUTH.y + (CENTRE.y - GOAL_MOUTH.y) * eased,
      inFlight: false,
    };
  }

  return ballFromPossession(
    playClockAt(t),
    playersAt(t, "home"),
    playersAt(t, "away"),
  );
}

/* ── Price and momentum ──────────────────────────────────────────────────── */

const BASE_PRICE = 4.82;

function eventsBefore(t: number): MatchEvent[] {
  return EVENTS.filter((event) => event.at <= t);
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
  for (const event of EVENTS) {
    if (event.at > t || !event.impulse) continue;
    const age = (t - event.at) / 1000;
    value += event.impulse * Math.exp(-age / 4.5);
  }
  return clamp(value, -96, 96);
}

export type MomentumBar = { value: number; revealed: boolean; current: boolean };

/* ── State ───────────────────────────────────────────────────────────────── */

export type ShotLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  outcome: ShotOutcome;
  xg: number;
  /** 1 → 0 as the line fades. */
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
  ball: { x: number; y: number; inFlight: boolean };
  ballTrail: { x: number; y: number }[];
  homePlayers: { x: number; y: number }[];
  awayPlayers: { x: number; y: number }[];
  holder: { team: Team; idx: number } | null;
  feed: { minute: string; type: EventType; detail: string; xg?: number }[];
  momentum: MomentumBar[];
  momentumLeader: string;
  shotLine: ShotLine | null;
  card: { x: number; y: number; colour: "yellow" | "red" } | null;
  goalBadge: { scorer: string; minute: string; score: string } | null;
  /** True while the net should flash. */
  netFlash: boolean;
  price: number;
  priceDelta: number;
  cause: { label: string; minute: string } | null;
  candleIndex: number;
};

const SHOT_LINE_MS = 1_800;
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

/** Target on the goal line for a shot, so lines converge plausibly. */
function shotTarget(team: Team, outcome: ShotOutcome): { x: number; y: number } {
  const x = team === "home" ? 98 : 2;
  if (outcome === "off") return { x, y: team === "home" ? 26 : 74 };
  if (outcome === "blocked") return { x: team === "home" ? 74 : 26, y: 44 };
  return { x, y: 50 };
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

  // Trail sampled from the same pure function, so it can never disagree.
  const ballTrail =
    phase === "kickoff" || phase === "set"
      ? []
      : [90, 190, 300].map((back) => {
          const p = ballAt(Math.max(0, t - back));
          return { x: p.x, y: p.y };
        });

  const holder =
    phase === "play" || phase === "stoppage"
      ? (() => {
          const { from } = possessionAt(playTime);
          return { team: from.team, idx: from.idx };
        })()
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

  // Most recent shot, still within its fade window.
  const recentShot = [...past]
    .reverse()
    .find((e) => e.shooter && e.outcome && t - e.at < SHOT_LINE_MS);

  let shotLine: ShotLine | null = null;
  if (recentShot?.shooter && recentShot.outcome) {
    const shooters =
      recentShot.shooter.team === "home"
        ? playersAt(recentShot.at, "home")
        : playersAt(recentShot.at, "away");
    const origin = shooters[recentShot.shooter.idx];
    const target = shotTarget(recentShot.shooter.team, recentShot.outcome);
    shotLine = {
      x1: origin.x,
      y1: origin.y,
      x2: target.x,
      y2: target.y,
      outcome: recentShot.outcome,
      xg: recentShot.xg ?? 0,
      strength: 1 - (t - recentShot.at) / SHOT_LINE_MS,
    };
  }

  // The card sits on the offender for the stoppage plus a short beat after.
  const cardEvent = EVENTS.find((e) => e.card && e.cardOn);
  let card: MatchState["card"] = null;
  if (cardEvent?.cardOn && t >= cardEvent.at && t < T_CARD_END + 1_200) {
    const offenders =
      cardEvent.cardOn.team === "home" ? homePlayers : awayPlayers;
    const at = offenders[cardEvent.cardOn.idx];
    card = { x: at.x, y: at.y, colour: cardEvent.card! };
  }

  const scoring = past.filter((e) => e.scores).length;
  const goalEvent = EVENTS.find((e) => e.scores)!;
  const goalBadge =
    t >= T_GOAL && t < T_GOAL + GOAL_BADGE_MS
      ? {
          scorer: TRACKED_PLAYER,
          minute: minuteAt(goalEvent.at),
          score: `${1 + scoring}–1`,
        }
      : null;

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
    feed: [...past]
      .reverse()
      .slice(0, 6)
      .map((e) => ({
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
  open: number;
  close: number;
  high: number;
  low: number;
  live: boolean;
  spike: boolean;
};

/**
 * Only the rightmost candle moves: it grows as the price does, then closes and a
 * new one opens. Past candles are frozen, because in a real market past prices
 * don't change — the chart is a record, not decoration.
 */
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
    for (let ms = startMs; ms <= limit; ms += CANDLE_MS / 6) {
      samples.push(priceAt(ms));
    }
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
