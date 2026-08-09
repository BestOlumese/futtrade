/**
 * Phase 04 — turning what the sim decided into structured events.
 *
 * The spine of the whole product, per AGENTS.md: the shot map, heatmap,
 * momentum graph, ticker, player ratings and market prices are all derived from
 * this stream and from no other data path. Read
 * docs/features/03-event-stream.md before changing any of it.
 *
 * The governing idea is that nothing here INVENTS an outcome. The Phase 02 sim
 * is a tuned probability tree and its distribution must not move, so every
 * position and player below is derived from a decision the sim already made — a
 * shot's location comes from its own chance quality, pass volume comes from
 * possession share, tackles come from pressing. That is the difference between
 * a shot map that means something and a scatter of dots.
 *
 * Coordinates are ALWAYS measured toward the goal the acting side is attacking,
 * for both sides and in both halves. x = 95 is near the opponent's goal whoever
 * took the shot. Flipping is the renderer's job, once, where direction of play
 * is already a rendering concern.
 */

export const PITCH_X_M = 105;
export const PITCH_Y_M = 68;

export type Side = "home" | "away";
export type EventType = "shot" | "pass" | "tackle" | "card" | "sub";

export type MatchEvent = {
  /** 1..N across the match, contiguous. Assigned when the tick closes. */
  seq: number;
  tick: number;
  minute: number;
  side: Side;
  type: EventType;
  outcome: string;
  x: number;
  y: number;
  xg: number | null;
  shirt: number;
  /** Same side as `shirt` for every type except `tackle`, where it's the opponent. */
  secondaryShirt: number | null;
};

/* ── Shirt numbers ────────────────────────────────────────────────────────────
   A 4-4-2. Real players arrive in Phase 09; until then a shirt number is a
   genuinely meaningful identifier — it says which role did the thing — and it
   survives the arrival of real squads unchanged rather than being replaced.
   ──────────────────────────────────────────────────────────────────────────*/

export const GK = [1];
export const DEF = [2, 3, 4, 5];
export const MID = [6, 7, 8, 11];
export const FWD = [9, 10];

type RoleWeights = { gk: number; def: number; mid: number; fwd: number };

/** Per-PLAYER weights, so `def: 3` means each of the four defenders weighs 3. */
const WEIGHTS: Record<string, RoleWeights> = {
  // Strikers shoot, defenders occasionally, the keeper essentially never.
  shot: { gk: 0.01, def: 0.5, mid: 1.6, fwd: 4.5 },
  // The chance creator: wide midfielders and the second striker.
  assist: { gk: 0.05, def: 0.7, mid: 2.6, fwd: 2.2 },
  tackle: { gk: 0.15, def: 3.0, mid: 2.0, fwd: 0.5 },
  pass: { gk: 0.7, def: 2.4, mid: 3.2, fwd: 1.4 },
  // Cards follow the tackles that earn them, so the shape is similar.
  card: { gk: 0.15, def: 2.2, mid: 2.0, fwd: 0.9 },
};

/**
 * Cumulative weight tables, built once. Event generation runs a few hundred
 * times a match and the tuning harness plays twenty thousand matches, so this
 * is not a place to be rebuilding arrays.
 */
const TABLES = new Map<string, { shirts: number[]; cumulative: number[]; total: number }>();
for (const [name, w] of Object.entries(WEIGHTS)) {
  const shirts: number[] = [];
  const cumulative: number[] = [];
  let running = 0;
  for (const [band, weight] of [
    [GK, w.gk], [DEF, w.def], [MID, w.mid], [FWD, w.fwd],
  ] as [number[], number][]) {
    for (const shirt of band) {
      running += weight;
      shirts.push(shirt);
      cumulative.push(running);
    }
  }
  TABLES.set(name, { shirts, cumulative, total: running });
}

/** A shirt number weighted by how often that role does this kind of thing. */
export function pickShirt(kind: keyof typeof WEIGHTS, rng: () => number): number {
  const table = TABLES.get(kind)!;
  const target = rng() * table.total;
  for (let i = 0; i < table.cumulative.length; i++) {
    if (target <= table.cumulative[i]) return table.shirts[i];
  }
  return table.shirts[table.shirts.length - 1];
}

/** A second, different shirt — an assister is never the shooter. */
function pickOtherShirt(
  kind: keyof typeof WEIGHTS,
  exclude: number,
  rng: () => number,
): number {
  for (let attempt = 0; attempt < 6; attempt++) {
    const shirt = pickShirt(kind, rng);
    if (shirt !== exclude) return shirt;
  }
  // Vanishingly unlikely; falling back beats looping forever.
  return exclude === 10 ? 9 : 10;
}

/* ── Geometry ─────────────────────────────────────────────────────────────── */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Two uniforms averaged — a triangular bulge instead of a flat smear. */
const bulge = (rng: () => number) => rng() + rng() - 1;

/**
 * Where a shot was taken from, derived from the chance quality the sim rolled.
 *
 * This is the inverse of an xG model rather than a decoration: a 0.44 chance is
 * placed near the spot, a 0.04 one is placed some 28 m out at a tight angle, and
 * the angle spread widens as quality falls because poor chances are the ones
 * taken from bad positions. A shot map built on this shows the real relationship
 * between where you shoot from and whether you score.
 */
export function shotLocation(quality: number, rng: () => number): { x: number; y: number } {
  const q = clamp(quality, 0.01, 0.95);

  // Metres from the centre of the goal: 0.17 → ~10 m, 0.10 → ~16 m,
  // 0.04 → ~24 m, 0.02 → ~28 m.
  //
  // The exponent is high because it has to be. The Phase 02 sim draws chance
  // quality from a narrow band around 0.10, so a gentle curve maps almost every
  // shot to roughly the same distance and the shot map comes out as a ring at
  // 24 m with nothing inside it. Calibrated against the quality range the sim
  // actually produces, this gives a median around 16 m — real top-flight
  // football is about 17.
  //
  // What it cannot produce is a genuine tap-in, because the sim has no such
  // thing as a 0.6 chance yet. That is a Phase 02 limitation of the quality
  // distribution, not of this mapping, and it resolves when attributes and
  // chance types arrive rather than by distorting the curve here.
  const distance = (5 + 28 * (1 - q) ** 9) * (0.85 + rng() * 0.3);
  const spread = 0.22 + 0.45 * (1 - q);
  const angle = (rng() * 2 - 1) * spread;

  return {
    x: clamp(100 - (distance * Math.cos(angle) * 100) / PITCH_X_M, 30, 99.5),
    y: clamp(50 + (distance * Math.sin(angle) * 100) / PITCH_Y_M, 2, 98),
  };
}

/** Mentality pushes a side's passing further up or further back. */
const MENTALITY_X_SHIFT: Record<string, number> = {
  defensive: -9,
  balanced: 0,
  attacking: 9,
};

/** Pressing decides how high up the pitch you try to win the ball. */
const PRESSING_X_SHIFT: Record<string, number> = {
  low: -12,
  medium: 0,
  high: 12,
};

export function passLocation(
  mentality: string,
  rng: () => number,
): { x: number; y: number } {
  return {
    x: clamp(48 + bulge(rng) * 40 + (MENTALITY_X_SHIFT[mentality] ?? 0), 3, 96),
    y: clamp(50 + bulge(rng) * 46, 2, 98),
  };
}

/**
 * Where a tackle happened, from the TACKLER's attacking direction — so a low
 * block wins the ball around x = 26 and a high press around x = 50.
 */
export function tackleLocation(
  pressing: string,
  rng: () => number,
): { x: number; y: number } {
  return {
    x: clamp(38 + bulge(rng) * 28 + (PRESSING_X_SHIFT[pressing] ?? 0), 3, 92),
    y: clamp(50 + bulge(rng) * 44, 2, 98),
  };
}

/* ── Clock ────────────────────────────────────────────────────────────────── */

/**
 * A display minute spread WITHIN the tick.
 *
 * Stored rather than derived precisely because it is not `tick × 3`: five events
 * all stamped 45' would make the ticker look broken, and a momentum graph drawn
 * from them would be a staircase.
 */
export function minuteWithinTick(
  tick: number,
  minutesPerTick: number,
  rng: () => number,
): number {
  return (tick - 1) * minutesPerTick + 1 + Math.floor(rng() * minutesPerTick);
}

/* ── Shot outcome ─────────────────────────────────────────────────────────── */

/**
 * What became of a shot that did not go in. Better chances are struck from
 * better positions, so they end up on target more often and blocked less.
 */
export function missOutcome(quality: number, rng: () => number): string {
  const saved = 0.30 + 0.25 * quality;
  const blocked = saved + (0.30 - 0.10 * quality);
  const roll = rng();
  if (roll < saved) return "saved";
  if (roll < blocked) return "blocked";
  return "off_target";
}

/* ── Derivation ───────────────────────────────────────────────────────────── */

export type SideTotals = {
  shots: number;
  goals: number;
  xg: number;
  fouls: number;
  yellows: number;
  reds: number;
  passes: number;
  passesCompleted: number;
  tackles: number;
};

/**
 * A side's match totals, from the event log and NOTHING else.
 *
 * This is the design rule of the whole product made concrete: before adding any
 * stat, chart or price mechanic, check whether it can be derived here. It is
 * also what the exit criterion is asserted against — the numbers this returns
 * must equal what the sim privately recorded.
 */
export function totalsFrom(events: MatchEvent[], side: Side): SideTotals {
  const totals: SideTotals = {
    shots: 0, goals: 0, xg: 0, fouls: 0, yellows: 0, reds: 0,
    passes: 0, passesCompleted: 0, tackles: 0,
  };

  for (const e of events) {
    if (e.side !== side) continue;
    totals.xg += e.xg ?? 0;
    switch (e.type) {
      case "shot":
        totals.shots++;
        if (e.outcome === "goal") totals.goals++;
        break;
      case "pass":
        totals.passes++;
        if (e.outcome === "complete") totals.passesCompleted++;
        break;
      case "tackle":
        totals.tackles++;
        if (e.outcome === "foul") totals.fouls++;
        break;
      case "card":
        if (e.outcome === "yellow") totals.yellows++;
        else totals.reds++;
        break;
    }
  }

  return totals;
}

/** Better chances are more often created by someone else rather than worked alone. */
export function assistFor(
  shooter: number,
  quality: number,
  rng: () => number,
): number | null {
  return rng() < 0.5 + 0.4 * quality ? pickOtherShirt("assist", shooter, rng) : null;
}
