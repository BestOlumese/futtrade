/**
 * The landing page's scripted match — a single event stream that drives every
 * animated surface on the page.
 *
 * This mirrors the real architecture on purpose. AGENTS.md: "One event stream
 * powers everything downstream: the live 2D viewer, post-match stats, player
 * Form and market price movement." The demo works the same way, so a goal at
 * 71' moves the scoreline, the xG, the momentum strip AND the share price
 * because they are all derived from the same event — not because five widgets
 * were each told to look busy.
 *
 * `matchStateAt` is a pure function of elapsed loop time. That means:
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
  /** Offset into the loop, in ms. */
  at: number;
  type: EventType;
  detail: string;
  /** Present on shooting events only. */
  xg?: number;
  /** Shots counter increments on these. */
  isShot?: boolean;
  /** Drives the price step and the "cause" marker. */
  priceStep?: number;
  /** Momentum impulse, positive = home. */
  impulse?: number;
  scores?: boolean;
};

/**
 * The passage. Ordered by `at`.
 * Reads as one coherent stretch of play building to a goal, then settling.
 */
export const EVENTS: MatchEvent[] = [
  { at: 6_000, type: "Tackle", detail: "Marek wins it back", impulse: 14 },
  { at: 13_000, type: "Shot", detail: "Orsi · blocked", xg: 0.09, isShot: true, priceStep: 0.02, impulse: 22 },
  { at: 21_000, type: "Save", detail: "Voss · low to the right", xg: 0.31, isShot: true, priceStep: 0.05, impulse: 30 },
  { at: 30_000, type: "Sub", detail: "Renn on for Kavan", impulse: -6 },
  { at: 40_000, type: "Goal", detail: `${TRACKED_PLAYER} · left foot`, xg: 0.44, isShot: true, priceStep: 0.27, impulse: 46, scores: true },
  { at: 52_000, type: "Card", detail: "Ardor SC · dissent", impulse: 8 },
  { at: 60_000, type: "Shot", detail: `${TRACKED_PLAYER} · over`, xg: 0.12, isShot: true, priceStep: 0.04, impulse: 18 },
  { at: 67_000, type: "Tackle", detail: "Delane dispossessed", impulse: -12 },
];

/**
 * Ball waypoints through the passage, as percentages of the pitch box.
 * The ball moves between these; the client interpolates with a CSS transition
 * rather than teleporting — the same "interpolate between ticks, never
 * extrapolate" rule the real viewer follows.
 */
const BALL_PATH: { at: number; x: number; y: number }[] = [
  { at: 0, x: 30, y: 52 },
  { at: 4_000, x: 22, y: 34 },
  { at: 6_000, x: 34, y: 40 },
  { at: 9_000, x: 48, y: 30 },
  { at: 13_000, x: 68, y: 38 },
  { at: 16_000, x: 55, y: 58 },
  { at: 21_000, x: 78, y: 50 },
  { at: 24_000, x: 40, y: 62 },
  { at: 30_000, x: 30, y: 48 },
  { at: 34_000, x: 46, y: 40 },
  { at: 37_000, x: 62, y: 34 },
  { at: 40_000, x: 88, y: 50 },
  { at: 44_000, x: 50, y: 50 },
  { at: 48_000, x: 36, y: 60 },
  { at: 52_000, x: 52, y: 44 },
  { at: 57_000, x: 70, y: 36 },
  { at: 60_000, x: 84, y: 42 },
  { at: 64_000, x: 46, y: 56 },
  { at: 67_000, x: 32, y: 46 },
  { at: LOOP_MS, x: 30, y: 52 },
];

/** Base formations, percentages. Home attacks right. */
const HOME_SHAPE: [number, number][] = [
  [6, 50], [20, 18], [20, 40], [20, 60], [20, 82],
  [36, 28], [36, 50], [36, 72], [54, 20], [54, 50], [54, 80],
];

const AWAY_SHAPE: [number, number][] = [
  [94, 50], [80, 18], [80, 40], [80, 60], [80, 82],
  [64, 28], [64, 50], [64, 72], [46, 24], [46, 50], [46, 76],
];

const BASE_PRICE = 4.82;

function eventsBefore(t: number): MatchEvent[] {
  return EVENTS.filter((event) => event.at <= t);
}

function ballAt(t: number): { x: number; y: number } {
  let previous = BALL_PATH[0];
  for (const point of BALL_PATH) {
    if (point.at > t) {
      const span = point.at - previous.at || 1;
      const progress = (t - previous.at) / span;
      return {
        x: previous.x + (point.x - previous.x) * progress,
        y: previous.y + (point.y - previous.y) * progress,
      };
    }
    previous = point;
  }
  return { x: previous.x, y: previous.y };
}

/**
 * Players hold their shape but drift toward the ball, strongest for whoever is
 * nearest. Enough to read as football; far short of a simulation, which is
 * Phase 02's job and not the landing page's.
 */
function shapeToward(
  shape: [number, number][],
  ball: { x: number; y: number },
): { x: number; y: number }[] {
  return shape.map(([bx, by]) => {
    const dx = ball.x - bx;
    const dy = ball.y - by;
    const distance = Math.hypot(dx, dy);
    const pull = Math.max(0, 1 - distance / 45) * 0.3;
    return { x: bx + dx * pull, y: by + dy * pull };
  });
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

export function priceAt(t: number): number {
  const stepped = eventsBefore(t).reduce(
    (total, event) => total + (event.priceStep ?? 0),
    0,
  );
  return BASE_PRICE + stepped + wobble(t);
}

export const MOMENTUM_BARS = 18;
const MOMENTUM_SLICE_MS = LOOP_MS / MOMENTUM_BARS;

/**
 * Momentum for one slice: a slow underlying swing plus decaying impulses from
 * events. Positive means Kestrel are on top.
 */
function momentumAt(t: number): number {
  const s = Math.max(t, 0) / 1000;
  let value = Math.sin(s * 0.28) * 26 + Math.sin(s * 0.11 + 2) * 12;
  for (const event of EVENTS) {
    if (event.at > t || !event.impulse) continue;
    const age = (t - event.at) / 1000;
    value += event.impulse * Math.exp(-age / 5);
  }
  return Math.max(-95, Math.min(95, value));
}

export type MatchState = {
  matchSecond: number;
  clock: string;
  homeScore: number;
  awayScore: number;
  shots: number;
  xg: number;
  passes: number;
  possession: number;
  ball: { x: number; y: number };
  homePlayers: { x: number; y: number }[];
  awayPlayers: { x: number; y: number }[];
  /** Newest first. */
  feed: { minute: string; type: EventType; detail: string; xg?: number }[];
  momentum: number[];
  price: number;
  priceDelta: number;
  /** The event currently being credited for the price level. */
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

  const ball = ballAt(t);

  const momentum = Array.from({ length: MOMENTUM_BARS }, (_, i) =>
    momentumAt(t - (MOMENTUM_BARS - 1 - i) * MOMENTUM_SLICE_MS),
  );

  const price = priceAt(t);

  const scoring = past.filter((event) => event.scores).length;
  const lastPriceEvent = [...past].reverse().find((event) => event.priceStep);

  return {
    matchSecond,
    clock: formatClock(matchSecond),
    homeScore: 1 + scoring,
    awayScore: 1,
    shots: 11 + past.filter((event) => event.isShot).length,
    xg: Number(
      (1.21 + past.reduce((sum, event) => sum + (event.xg ?? 0), 0)).toFixed(2),
    ),
    // Passes tick along steadily — the most common event in any match.
    passes: 431 + Math.floor(t / 620),
    possession: Math.round(58 + Math.sin(t / 9000) * 5),
    ball,
    homePlayers: shapeToward(HOME_SHAPE, ball),
    awayPlayers: shapeToward(AWAY_SHAPE, ball),
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
  /** True when a scoring event falls inside this candle's window. */
  spike: boolean;
};

/**
 * Candles for the live intraday chart.
 *
 * Only the rightmost candle moves: it grows as the price does, then closes when
 * its window ends and a new one opens. Past candles are frozen, because in a
 * real market past prices don't change — the whole point of the section is that
 * the chart is a record, not decoration.
 */
export function candlesAt(rawT: number): Candle[] {
  const t = ((rawT % LOOP_MS) + LOOP_MS) % LOOP_MS;
  const current = Math.floor(t / CANDLE_MS);

  return Array.from({ length: CANDLE_COUNT }, (_, i) => {
    const startMs = i * CANDLE_MS;
    const endMs = (i + 1) * CANDLE_MS;
    const isLive = i === current;
    const isFuture = i > current;

    const open = priceAt(startMs);
    const close = isLive ? priceAt(t) : priceAt(endMs);

    // Sample the window so wicks reflect the actual path, not just endpoints.
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
      // Future candles are not drawn; the flag keeps the array a fixed length
      // so the chart's x-axis never jumps.
      ...(isFuture ? { open: NaN, close: NaN, high: NaN, low: NaN } : {}),
    };
  });
}
