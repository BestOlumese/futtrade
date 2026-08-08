/**
 * The landing page's scripted match — a single event stream that drives every
 * animated surface on the page.
 *
 * This mirrors the real architecture on purpose. AGENTS.md: "One event stream
 * powers everything downstream: the live 2D viewer, post-match stats, player
 * Form and market price movement." The demo works the same way, so a goal at
 * 72' moves the scoreline, the xG, the momentum timeline AND the share price
 * because they are all derived from the same event.
 *
 * Direction of causation matters here. Possession is the script; the ball's
 * position is *derived from whoever is holding it*, not from a path of its own.
 * That is what makes a pass actually arrive at a player's feet — an earlier
 * version moved the ball along hardcoded coordinates and it floated through
 * empty space, because nothing tied it to the players.
 *
 * `matchStateAt` is a pure function of elapsed loop time, so:
 *   - server and client render identically (no hydration mismatch)
 *   - a section scrolled back into view is instantly in sync, not restarted
 *   - the loop is seamless, because state at LOOP_MS equals state at 0
 *
 * None of this is real data, and it is deliberately not wired to a live match:
 * the landing page has to work for a first-time visitor when nothing is live.
 */

export const LOOP_MS = 72_000;

/** Match seconds elapsed per real second — the passage is time-compressed. */
const MATCH_SPEED = 12;

/** Kickoff offset for the passage we replay: 64:12. */
const MATCH_START_SECOND = 64 * 60 + 12;

export const HOME = { name: "Kestrel FC", short: "KES" };
export const AWAY = { name: "Ardor SC", short: "ARD" };

/** The player whose shares the Bourse section tracks. */
export const TRACKED_PLAYER = "A. Delane";

export type EventType = "Shot" | "Save" | "Goal" | "Card" | "Sub" | "Tackle";

export type MatchEvent = {
  at: number;
  type: EventType;
  detail: string;
  xg?: number;
  isShot?: boolean;
  priceStep?: number;
  /** Momentum impulse, positive = home. */
  impulse?: number;
  scores?: boolean;
};

export const EVENTS: MatchEvent[] = [
  { at: 6_000, type: "Tackle", detail: "Marek wins it back", impulse: 14 },
  { at: 13_000, type: "Shot", detail: "Orsi · blocked", xg: 0.09, isShot: true, priceStep: 0.02, impulse: 22 },
  { at: 21_000, type: "Save", detail: "Voss · low to the right", xg: 0.31, isShot: true, priceStep: 0.05, impulse: -18 },
  { at: 30_000, type: "Sub", detail: "Renn on for Kavan", impulse: 6 },
  { at: 40_000, type: "Goal", detail: `${TRACKED_PLAYER} · left foot`, xg: 0.44, isShot: true, priceStep: 0.27, impulse: 48, scores: true },
  { at: 52_000, type: "Card", detail: "Ardor SC · dissent", impulse: 10 },
  { at: 60_000, type: "Shot", detail: `${TRACKED_PLAYER} · over`, xg: 0.12, isShot: true, priceStep: 0.04, impulse: 18 },
  { at: 67_000, type: "Tackle", detail: "Delane dispossessed", impulse: -14 },
];

/**
 * Formations. Index 0 is the keeper. Home attacks right, away attacks left.
 * These are *base* positions — the live positions add a team block shift plus a
 * small per-player drift.
 */
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

export type Team = "home" | "away";

/**
 * The possession chain: who has the ball, and when they got it.
 * Ordered by `at`. The final entry returns possession to the same player who
 * holds it at t=0, so the loop closes without a visible jump.
 */
const POSSESSION: { at: number; team: Team; idx: number }[] = [
  { at: 0, team: "home", idx: 6 },
  { at: 2_500, team: "home", idx: 2 },
  { at: 4_500, team: "away", idx: 8 },
  { at: 6_000, team: "home", idx: 6 },
  { at: 9_000, team: "home", idx: 5 },
  { at: 11_500, team: "home", idx: 8 },
  { at: 13_000, team: "home", idx: 10 },
  { at: 14_500, team: "away", idx: 2 },
  { at: 17_000, team: "away", idx: 6 },
  { at: 19_500, team: "away", idx: 9 },
  { at: 21_000, team: "home", idx: 0 },
  { at: 23_500, team: "home", idx: 3 },
  { at: 26_500, team: "home", idx: 7 },
  { at: 30_000, team: "home", idx: 5 },
  { at: 33_000, team: "home", idx: 6 },
  { at: 36_000, team: "home", idx: 9 },
  { at: 38_000, team: "home", idx: 8 },
  { at: 40_000, team: "home", idx: 10 },
  { at: 41_500, team: "away", idx: 0 },
  { at: 44_000, team: "away", idx: 6 },
  { at: 47_000, team: "home", idx: 6 },
  { at: 50_000, team: "home", idx: 5 },
  { at: 52_500, team: "home", idx: 7 },
  { at: 55_000, team: "home", idx: 8 },
  { at: 58_000, team: "home", idx: 9 },
  { at: 60_000, team: "home", idx: 10 },
  { at: 62_000, team: "away", idx: 0 },
  { at: 65_000, team: "away", idx: 6 },
  { at: 67_000, team: "away", idx: 5 },
  { at: 69_500, team: "away", idx: 2 },
  { at: LOOP_MS, team: "home", idx: 6 },
];

/** How long the ball is in flight at the end of each possession segment. */
const PASS_FLIGHT_MS = 600;

const BASE_PRICE = 4.82;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shapeFor(team: Team): [number, number][] {
  return team === "home" ? HOME_SHAPE : AWAY_SHAPE;
}

/** Index into POSSESSION for time t, and the segment's boundaries. */
function possessionAt(t: number) {
  let i = 0;
  for (let k = 0; k < POSSESSION.length - 1; k++) {
    if (POSSESSION[k].at <= t) i = k;
  }
  const from = POSSESSION[i];
  const to = POSSESSION[i + 1] ?? POSSESSION[0];
  return { from, to, startsAt: from.at, endsAt: to.at };
}

/**
 * The point play is focused on, derived from BASE positions only.
 *
 * Deliberately independent of live player positions: the block shift is
 * computed from this, and the ball is computed from the shifted players, so
 * using live positions here would be circular.
 */
function focusAt(t: number): { x: number; y: number } {
  const { from, to, startsAt, endsAt } = possessionAt(t);
  const a = shapeFor(from.team)[from.idx];
  const b = shapeFor(to.team)[to.idx];
  const span = endsAt - startsAt || 1;
  const progress = clamp((t - startsAt) / span, 0, 1);
  // Ease so the focus lingers with the holder rather than sliding constantly.
  const eased = progress * progress * (3 - 2 * progress);
  return { x: a[0] + (b[0] - a[0]) * eased, y: a[1] + (b[1] - a[1]) * eased };
}

/**
 * Live positions: base shape, shifted as a block toward where play is, plus a
 * small per-player wander so nobody is ever perfectly frozen.
 *
 * Keepers barely move — they hold their line rather than following play upfield.
 */
function playersAt(t: number, team: Team): { x: number; y: number }[] {
  const focus = focusAt(t);
  const shape = shapeFor(team);
  const seconds = t / 1000;

  const shiftX = (focus.x - 50) * (team === "home" ? 0.3 : 0.26);
  const shiftY = (focus.y - 50) * (team === "home" ? 0.2 : 0.17);

  return shape.map(([bx, by], i) => {
    const keeper = i === 0;
    const shiftScale = keeper ? 0.15 : 1;
    const driftScale = keeper ? 0.5 : 1;

    const driftX = Math.sin(seconds * 0.55 + i * 1.7) * 1.9 * driftScale;
    const driftY = Math.cos(seconds * 0.47 + i * 2.3) * 2.2 * driftScale;

    return {
      x: clamp(bx + shiftX * shiftScale + driftX, 2.5, 97.5),
      y: clamp(by + shiftY * shiftScale + driftY, 4, 96),
    };
  });
}

/**
 * The ball sits on whoever is holding it, then flies to the next receiver over
 * the last PASS_FLIGHT_MS of the segment — so it always leaves a player and
 * always arrives at one.
 *
 * Positions come from the same `playersAt` call the renderer uses, which is why
 * the ball lands exactly on a dot rather than near it.
 */
function ballAt(
  t: number,
  home: { x: number; y: number }[],
  away: { x: number; y: number }[],
): { x: number; y: number; inFlight: boolean } {
  const { from, to, endsAt } = possessionAt(t);
  const pick = (team: Team, idx: number) => (team === "home" ? home : away)[idx];

  const holder = pick(from.team, from.idx);
  const flightStart = endsAt - PASS_FLIGHT_MS;

  if (t < flightStart) {
    return { x: holder.x, y: holder.y, inFlight: false };
  }

  const receiver = pick(to.team, to.idx);
  const progress = clamp((t - flightStart) / PASS_FLIGHT_MS, 0, 1);
  // Ease out: the ball leaves quickly and settles into the receiver.
  const eased = 1 - Math.pow(1 - progress, 2);

  return {
    x: holder.x + (receiver.x - holder.x) * eased,
    y: holder.y + (receiver.y - holder.y) * eased,
    inFlight: true,
  };
}

function formatClock(matchSecond: number): string {
  const minutes = Math.floor(matchSecond / 60);
  const seconds = Math.floor(matchSecond % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Deterministic wobble so the price drifts between events without RNG. */
function wobble(t: number): number {
  const s = t / 1000;
  return (
    Math.sin(s * 0.9) * 0.018 +
    Math.sin(s * 2.3 + 1.2) * 0.011 +
    Math.sin(s * 0.37 + 0.6) * 0.014
  );
}

function eventsBefore(t: number): MatchEvent[] {
  return EVENTS.filter((event) => event.at <= t);
}

export function priceAt(t: number): number {
  const stepped = eventsBefore(t).reduce(
    (total, event) => total + (event.priceStep ?? 0),
    0,
  );
  return BASE_PRICE + stepped + wobble(t);
}

/**
 * Momentum is a TIMELINE across the whole passage, not a scrolling window.
 *
 * Bar i covers a fixed slice of the passage. It is only revealed once its slice
 * has been played, so the future reads as empty rather than as invented history
 * — the previous version clamped negative times to zero and so opened with 18
 * identical bars that looked like momentum from before kickoff.
 */
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

export type MomentumBar = {
  /** −96..96, positive means home are on top. */
  value: number;
  /** False until this slice has been played. */
  revealed: boolean;
  /** The slice currently being played. */
  current: boolean;
};

export type MatchState = {
  matchSecond: number;
  clock: string;
  homeScore: number;
  awayScore: number;
  shots: number;
  xg: number;
  passes: number;
  possession: number;
  ball: { x: number; y: number; inFlight: boolean };
  homePlayers: { x: number; y: number }[];
  awayPlayers: { x: number; y: number }[];
  /** Newest first. */
  feed: { minute: string; type: EventType; detail: string; xg?: number }[];
  momentum: MomentumBar[];
  /** Which side is on top right now. */
  momentumLeader: string;
  price: number;
  priceDelta: number;
  cause: { label: string; minute: string } | null;
  candleIndex: number;
};

export const CANDLE_COUNT = 12;
const CANDLE_MS = LOOP_MS / CANDLE_COUNT;

export function matchStateAt(rawT: number): MatchState {
  const t = ((rawT % LOOP_MS) + LOOP_MS) % LOOP_MS;
  const matchSecond = MATCH_START_SECOND + (t / 1000) * MATCH_SPEED;
  const past = eventsBefore(t);

  const minuteOf = (at: number) =>
    `${Math.floor((MATCH_START_SECOND + (at / 1000) * MATCH_SPEED) / 60)}'`;

  const homePlayers = playersAt(t, "home");
  const awayPlayers = playersAt(t, "away");
  const ball = ballAt(t, homePlayers, awayPlayers);

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
  const scoring = past.filter((event) => event.scores).length;
  const lastPriceEvent = [...past].reverse().find((event) => event.priceStep);
  const nowMomentum = momentum[currentSlice]?.value ?? 0;

  return {
    matchSecond,
    clock: formatClock(matchSecond),
    homeScore: 1 + scoring,
    awayScore: 1,
    shots: 11 + past.filter((event) => event.isShot).length,
    xg: Number(
      (1.21 + past.reduce((sum, event) => sum + (event.xg ?? 0), 0)).toFixed(2),
    ),
    passes: 431 + Math.floor(t / 620),
    possession: Math.round(58 + Math.sin(t / 9000) * 5),
    ball,
    homePlayers,
    awayPlayers,
    feed: [...past]
      .reverse()
      .slice(0, 6)
      .map((event) => ({
        minute: minuteOf(event.at),
        type: event.type,
        detail: event.detail,
        xg: event.xg,
      })),
    momentum,
    momentumLeader: nowMomentum >= 0 ? HOME.name : AWAY.name,
    price,
    priceDelta: price - BASE_PRICE,
    cause: lastPriceEvent
      ? {
          label: `${lastPriceEvent.type} · ${lastPriceEvent.detail}`,
          minute: minuteOf(lastPriceEvent.at),
        }
      : null,
    candleIndex: Math.floor(t / CANDLE_MS),
  };
}

export type Candle = {
  open: number;
  close: number;
  high: number;
  low: number;
  live: boolean;
  spike: boolean;
};

/**
 * Candles for the live intraday chart.
 *
 * Only the rightmost candle moves: it grows as the price does, then closes when
 * its window ends and a new one opens. Past candles are frozen, because in a
 * real market past prices don't change — the point of the section is that the
 * chart is a record, not decoration.
 */
export function candlesAt(rawT: number): Candle[] {
  const t = ((rawT % LOOP_MS) + LOOP_MS) % LOOP_MS;
  const current = Math.floor(t / CANDLE_MS);

  return Array.from({ length: CANDLE_COUNT }, (_, i) => {
    const startMs = i * CANDLE_MS;
    const endMs = (i + 1) * CANDLE_MS;
    const isLive = i === current;

    if (i > current) {
      return {
        open: NaN,
        close: NaN,
        high: NaN,
        low: NaN,
        live: false,
        spike: false,
      };
    }

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
      spike: EVENTS.some(
        (event) => event.scores && event.at >= startMs && event.at < endMs,
      ),
    };
  });
}
