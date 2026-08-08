/**
 * The two tactical dials, and what they cost.
 *
 * The design rule this file exists to enforce: neither dial may be strictly
 * better. If "attacking" or "high pressing" were simply stronger, there would
 * be no decision to make and the match would resolve itself. So each setting
 * buys something and pays for it somewhere else.
 *
 *   MENTALITY   attacking → you take more shots, and they take fewer,
 *               but the ones they do take are much better chances.
 *
 *   PRESSING    high → you win the ball back more often,
 *               but the space behind you makes their chances better.
 *
 * The numbers are multipliers against the baselines in match-sim.ts. They were
 * tuned by running the harness, not guessed — see `npm run sim:tune`.
 */

export const MENTALITIES = ["defensive", "balanced", "attacking"] as const;
export const PRESSING = ["low", "medium", "high"] as const;

export type Mentality = (typeof MENTALITIES)[number];
export type Pressing = (typeof PRESSING)[number];

export type Dials = { mentality: Mentality; pressing: Pressing };

export const DEFAULT_DIALS: Dials = { mentality: "balanced", pressing: "medium" };

export function isMentality(value: string): value is Mentality {
  return (MENTALITIES as readonly string[]).includes(value);
}

export function isPressing(value: string): value is Pressing {
  return (PRESSING as readonly string[]).includes(value);
}

type MentalityEffect = {
  /** Multiplier on your own shot volume. */
  shots: number;
  /** Multiplier on the opponent's shot volume — committing forward invites play. */
  concedeVolume: number;
  /** Multiplier on the QUALITY of chances you give up. The real cost. */
  concedeQuality: number;
  /** Share of possession this leans toward. */
  possession: number;
};

export const MENTALITY_EFFECT: Record<Mentality, MentalityEffect> = {
  defensive: {
    shots: 0.78,
    // Sitting deep invites pressure, but only a little — the real return is
    // that what they get is much poorer.
    concedeVolume: 1.06,
    concedeQuality: 0.66,
    possession: 0.92,
  },
  balanced: {
    shots: 1,
    concedeVolume: 1,
    concedeQuality: 1,
    possession: 1,
  },
  attacking: {
    shots: 1.28,
    concedeVolume: 0.94,
    // The cost, and it has to bite: commit forward and the chances you give up
    // are far better ones.
    concedeQuality: 1.52,
    possession: 1.08,
  },
};

type PressingEffect = {
  /** Multiplier on winning possession. */
  possession: number;
  /** Multiplier on the quality of chances you give up — space in behind. */
  concedeQuality: number;
  /** Slight drag on your own chance quality when sitting off. */
  shotQuality: number;
};

export const PRESSING_EFFECT: Record<Pressing, PressingEffect> = {
  low: {
    possession: 0.88,
    concedeQuality: 0.86,
    shotQuality: 0.94,
  },
  medium: {
    possession: 1,
    concedeQuality: 1,
    shotQuality: 1,
  },
  high: {
    possession: 1.16,
    concedeQuality: 1.22,
    shotQuality: 1.04,
  },
};
