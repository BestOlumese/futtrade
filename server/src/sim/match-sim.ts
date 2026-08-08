import {
  DEFAULT_DIALS,
  MENTALITY_EFFECT,
  PRESSING_EFFECT,
  type Dials,
} from "./dials.js";

/**
 * The Phase 02 match simulation.
 *
 * Deliberately a PURE function of (state, dials, rng). Nothing here touches the
 * room, the clock or the network — which is what lets the exit criterion be
 * proved: "repeated matches under different dial settings show a measurable and
 * sensible difference, not just noise" is a claim about a distribution, and you
 * cannot establish a distribution by playing a few matches by hand. The harness
 * runs this ten thousand times in a second.
 *
 * The model per tick is a small probability tree, as the phase spec asks:
 *
 *   possession share  →  how many shots each side gets
 *   shot              →  a chance quality (an xG-like number)
 *   quality           →  goal or no goal
 *
 * Every player is a flat rating for now; attributes arrive in Phase 09. Both
 * sides are therefore equal by default, which is exactly what the exit
 * criterion needs — any measured difference must come from the dials and
 * nothing else.
 */

export const TICKS_PER_MATCH = 30;
export const SIM_MINUTES_PER_TICK = 3;

/* ── Tuned constants ──────────────────────────────────────────────────────────
   Set by running `npm run sim:tune`, not by guessing. Targets, from real
   top-flight football: ~2.7 goals a match, 0-0 around 7-10%, blowouts rare.
   ──────────────────────────────────────────────────────────────────────────*/

/** Expected shots per side per tick at balanced/medium, both sides equal. */
const BASE_SHOTS_PER_TICK = 0.42;
/** Mean chance quality (xG) of a shot at balanced/medium. */
const BASE_CHANCE_QUALITY = 0.104;

export type SideState = {
  goals: number;
  shots: number;
  /** Accumulated chance quality — the xG this side has generated. */
  xg: number;
  /** Ticks in which this side had the majority of the ball. */
  possessionTicks: number;
};

export type MatchSimState = {
  tick: number;
  home: SideState;
  away: SideState;
};

export function emptySide(): SideState {
  return { goals: 0, shots: 0, xg: 0, possessionTicks: 0 };
}

export function newMatch(): MatchSimState {
  return { tick: 0, home: emptySide(), away: emptySide() };
}

/** Seedable RNG so a tuning run is reproducible and a regression is findable. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Home's share of the ball this tick, 0..1. */
export function possessionShare(home: Dials, away: Dials): number {
  const h =
    MENTALITY_EFFECT[home.mentality].possession *
    PRESSING_EFFECT[home.pressing].possession;
  const a =
    MENTALITY_EFFECT[away.mentality].possession *
    PRESSING_EFFECT[away.pressing].possession;
  return h / (h + a);
}

/** Expected shots for `side` this tick, given both sides' dials. */
function expectedShots(side: Dials, opponent: Dials, share: number): number {
  const own = MENTALITY_EFFECT[side.mentality].shots;
  // An opponent sitting deep concedes more of the ball but fewer clear looks;
  // one committing forward concedes fewer shots but better ones.
  const invited = MENTALITY_EFFECT[opponent.mentality].concedeVolume;
  // Possession is scaled around the 0.5 baseline so an even game reproduces the
  // base rate exactly, which is what makes the tuning constants meaningful.
  return BASE_SHOTS_PER_TICK * own * invited * (share / 0.5);
}

/** Mean quality of a chance for `side`, given what the opponent is doing. */
function chanceQuality(side: Dials, opponent: Dials): number {
  const openness =
    MENTALITY_EFFECT[opponent.mentality].concedeQuality *
    PRESSING_EFFECT[opponent.pressing].concedeQuality;
  const own = PRESSING_EFFECT[side.pressing].shotQuality;
  return BASE_CHANCE_QUALITY * openness * own;
}

/** Poisson draw, small means only — which is all this needs. */
function poisson(mean: number, rng: () => number): number {
  const limit = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > limit);
  return k - 1;
}

function takeShots(
  side: SideState,
  dials: Dials,
  opponent: Dials,
  share: number,
  rng: () => number,
) {
  const shots = poisson(expectedShots(dials, opponent, share), rng);
  const meanQuality = chanceQuality(dials, opponent);

  for (let i = 0; i < shots; i++) {
    // Chance quality varies shot to shot: most are half-chances, a few are
    // clear. A flat mean would make every shot identical and the scoreline
    // unnaturally smooth.
    //
    // The spread MUST average 1.0 or it silently rescales every chance — an
    // earlier 0.35 + rng()*1.9 averaged 1.3 and inflated scoring by a third
    // while the shot counts looked perfectly correct.
    const quality = Math.min(0.95, meanQuality * (0.2 + rng() * 1.6));
    side.shots += 1;
    side.xg += quality;
    if (rng() < quality) side.goals += 1;
  }
}

/**
 * Advances one tick. Mutates and returns the state, so the room can hold a
 * single object and the harness can loop cheaply.
 */
export function simulateTick(
  state: MatchSimState,
  homeDials: Dials,
  awayDials: Dials,
  rng: () => number,
): MatchSimState {
  const share = possessionShare(homeDials, awayDials);

  if (rng() < share) state.home.possessionTicks += 1;
  else state.away.possessionTicks += 1;

  takeShots(state.home, homeDials, awayDials, share, rng);
  takeShots(state.away, awayDials, homeDials, 1 - share, rng);

  state.tick += 1;
  return state;
}

export type MatchResult = {
  home: SideState;
  away: SideState;
  /** Home possession as a percentage, rounded. */
  homePossession: number;
};

/** Plays a whole match. Dials are fixed for the run — the room varies them live. */
export function simulateMatch(
  homeDials: Dials = DEFAULT_DIALS,
  awayDials: Dials = DEFAULT_DIALS,
  seed = 1,
): MatchResult {
  const state = newMatch();
  const rng = makeRng(seed);
  for (let i = 0; i < TICKS_PER_MATCH; i++) {
    simulateTick(state, homeDials, awayDials, rng);
  }
  return {
    home: state.home,
    away: state.away,
    homePossession: Math.round(
      (state.home.possessionTicks / TICKS_PER_MATCH) * 100,
    ),
  };
}
