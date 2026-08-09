import {
  DEFAULT_DIALS,
  MENTALITY_EFFECT,
  PRESSING_EFFECT,
  type Dials,
} from "./dials.js";
import {
  assistFor,
  minuteWithinTick,
  missOutcome,
  shotEnd,
  passLocation,
  pickShirt,
  shotLocation,
  tackleLocation,
  type MatchEvent,
  type Side,
} from "./events.js";

/**
 * The match simulation. Phase 02 tuned it; Phase 04 made it emit events.
 *
 * Deliberately a PURE function of (state, dials, rng). Nothing here touches the
 * room, the clock or the network — which is what lets the exit criteria be
 * proved: "repeated matches under different dial settings show a measurable and
 * sensible difference" is a claim about a distribution, and you cannot establish
 * a distribution by playing a few matches by hand. The harness runs this ten
 * thousand times in a second.
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
 *
 * ── Three random streams, and why ──────────────────────────────────────────
 *
 * Phase 04 has to attach a position and a player to everything the sim does,
 * which means a great many more random draws. Taking them from the one stream
 * would mean a match played WITH event collection diverged from the same seed
 * played without it — and then the tuning harness and the event verifier would
 * no longer be looking at the same matches.
 *
 *   rng       (passed in)   outcomes and volumes: shots, quality, goals, fouls,
 *                           and how many passes and tackles each side plays —
 *                           pass counts live here because Phase 05 defines
 *                           possession as pass share, which makes them a match
 *                           statistic rather than a decoration
 *   booking   (on state)    which shirt is carded — a second yellow is a red,
 *                           so this genuinely affects the match and must not
 *                           depend on whether anyone is watching
 *   detail    (on state)    positions and shirts — purely descriptive, drawn
 *                           only when events are actually collected
 *
 * The property this buys: a given seed produces the same scoreline whether or
 * not events are collected. It is worth the two extra lines.
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

/* ── Phase 04: fouls and cards ────────────────────────────────────────────────
   A card that changes nothing is decoration, and this product does not ship
   decoration. Fouls are caused by pressing and by not having the ball, a
   fraction are booked, and a red genuinely costs that side for the rest of the
   match. Reds stay rare enough that the tuned targets above still hold — which
   is asserted by `sim:tune`, not assumed.
   ──────────────────────────────────────────────────────────────────────────*/

/** Real top-flight football is ~11 fouls per side per match, over 30 ticks. */
const BASE_FOULS_PER_TICK = 0.367;
const YELLOW_PER_FOUL = 0.155;
const STRAIGHT_RED_PER_FOUL = 0.0018;

/**
 * How often a player already on a yellow is spared the next one.
 *
 * Without this the birthday paradox does the refereeing: ~1.8 bookings a side
 * spread over eleven role-weighted players collide often enough to produce 0.31
 * red cards a match, three times the real rate. The fix is not a fudge factor —
 * it is the thing that actually happens. A booked player backs out of
 * challenges, and his manager takes him off. So he is usually not the one who
 * commits the next foul worth booking.
 */
const BOOKED_PLAYER_AVOIDANCE = 0.82;

/** Playing with ten: fewer shots of your own... */
const RED_SHOT_PENALTY = 0.72;
/** ...and the chances you give up get considerably better. */
const RED_CONCEDE_QUALITY = 1.3;

/** Tackles won per side per tick, on top of the fouls drawn separately. */
const BASE_TACKLES_PER_TICK = 0.5;
/** Sampled, not exhaustive: ~10 a tick across both sides, ~300 a match. */
const PASSES_PER_TICK = 10;

export type SideState = {
  goals: number;
  shots: number;
  /** Accumulated chance quality — the xG this side has generated. */
  xg: number;
  /**
   * Passes played. Phase 05: possession is defined as PASS SHARE, which is how
   * real providers compute it from event data and the only definition derivable
   * from the event log.
   *
   * This used to be a count of ticks in which the side had the majority of the
   * ball — a different number, noisier, and one the stat card could not have
   * reproduced from `match_event`. Two figures both called "possession" is
   * exactly the second data path AGENTS.md forbids, so there is now one.
   */
  passes: number;
  /** Every tackle event, fouls included — so it equals `totalsFrom().tackles`. */
  tackles: number;
  fouls: number;
  yellows: number;
  reds: number;
  /** Shirts already booked, so a second yellow becomes a red. */
  booked: Set<number>;
};

export type MatchSimState = {
  tick: number;
  home: SideState;
  away: SideState;
  /** Next event sequence number. 1-based and contiguous across the match. */
  seq: number;
  booking: () => number;
  detail: () => number;
};

export function emptySide(): SideState {
  return {
    goals: 0, shots: 0, xg: 0, passes: 0, tackles: 0,
    fouls: 0, yellows: 0, reds: 0, booked: new Set(),
  };
}

/**
 * Possession as a percentage for the home side — pass share, rounded.
 *
 * The single definition of possession in the product. The stat card computes it
 * the same way from `match_event`, so the stored column and the displayed
 * number are the same number rather than two estimates of it.
 */
export function possessionPercent(home: SideState, away: SideState): number {
  const total = home.passes + away.passes;
  return total === 0 ? 50 : Math.round((home.passes / total) * 100);
}

export function newMatch(seed = 1): MatchSimState {
  return {
    tick: 0,
    home: emptySide(),
    away: emptySide(),
    seq: 1,
    // Decorrelated from the main stream, and from each other.
    booking: makeRng((seed ^ 0x9e3779b9) >>> 0),
    detail: makeRng((seed ^ 0x85ebca6b) >>> 0),
  };
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

/**
 * The events produced during one tick, before sequence numbers are assigned.
 * `undefined` means nobody is collecting, and the cosmetic draws are skipped
 * entirely rather than generated and thrown away.
 */
type Collector = MatchEvent[] | undefined;

function takeShots(
  side: SideState,
  opponent: SideState,
  sideName: Side,
  dials: Dials,
  opponentDials: Dials,
  share: number,
  rng: () => number,
  state: MatchSimState,
  out: Collector,
) {
  // Down to ten: fewer shots of your own, and the opponent's red makes yours
  // better. Both are `**reds` so a second dismissal compounds.
  const shots = poisson(
    expectedShots(dials, opponentDials, share) * RED_SHOT_PENALTY ** side.reds,
    rng,
  );
  const meanQuality =
    chanceQuality(dials, opponentDials) * RED_CONCEDE_QUALITY ** opponent.reds;

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

    const scored = rng() < quality;
    if (scored) side.goals += 1;

    if (!out) continue;

    // Everything below is derived from `quality`, which the sim already decided.
    const detail = state.detail;
    const where = shotLocation(quality, detail);
    const shooter = pickShirt("shot", detail);
    const outcome = scored ? "goal" : missOutcome(quality, detail);
    // Where it ended up. Descriptive only — the goal was decided above.
    const end = shotEnd(where.x, where.y, quality, outcome, detail);
    out.push({
      seq: 0,
      tick: state.tick + 1,
      minute: minuteWithinTick(state.tick + 1, SIM_MINUTES_PER_TICK, detail),
      side: sideName,
      type: "shot",
      outcome,
      x: where.x,
      y: where.y,
      xg: quality,
      endX: end.endX,
      endY: end.endY,
      endZ: end.endZ,
      shirt: shooter,
      secondaryShirt: assistFor(shooter, quality, detail),
    });
  }
}

/**
 * Fouls, and the cards that follow them.
 *
 * The count and the colour come from the main stream because they affect the
 * match; the carded shirt comes from `booking` because a second yellow is a red,
 * which also affects the match. Only the position is cosmetic.
 */
function commitFouls(
  side: SideState,
  sideName: Side,
  dials: Dials,
  share: number,
  rng: () => number,
  state: MatchSimState,
  out: Collector,
) {
  // Chasing the game without the ball is what earns fouls, so a side with less
  // of it commits more — which falls out of possession rather than being a
  // separate dial.
  const mean =
    BASE_FOULS_PER_TICK *
    PRESSING_EFFECT[dials.pressing].fouls *
    ((1 - share) / 0.5);
  const fouls = poisson(mean, rng);

  for (let i = 0; i < fouls; i++) {
    side.fouls += 1;
    // A foul IS a tackle event, so it counts toward the tackle total that
    // `totalsFrom()` reads back off the log.
    side.tackles += 1;

    const roll = rng();
    const straightRed = roll < STRAIGHT_RED_PER_FOUL;
    const booked = !straightRed && roll < YELLOW_PER_FOUL;

    let offender = pickShirt("card", state.booking);
    // A player already in the book usually keeps himself out of it — see
    // BOOKED_PLAYER_AVOIDANCE. One resample, so a side with most of its team
    // booked can still pick up a second yellow.
    if (side.booked.has(offender) && state.booking() < BOOKED_PLAYER_AVOIDANCE) {
      offender = pickShirt("card", state.booking);
    }

    // A second yellow for the same shirt is a red, exactly as in the real game.
    const secondYellow = booked && side.booked.has(offender);
    const red = straightRed || secondYellow;

    if (red) side.reds += 1;
    if (booked) {
      side.yellows += 1;
      side.booked.add(offender);
    }

    if (!out) continue;

    const detail = state.detail;
    const where = tackleLocation(dials.pressing, detail);
    const minute = minuteWithinTick(state.tick + 1, SIM_MINUTES_PER_TICK, detail);

    // The foul itself is a tackle that went wrong. The fouled player is on the
    // OTHER side — the one exception to how secondaryShirt is read.
    out.push({
      seq: 0, tick: state.tick + 1, minute, side: sideName,
      type: "tackle", outcome: "foul",
      x: where.x, y: where.y, xg: null, endX: null, endY: null, endZ: null,
      shirt: offender, secondaryShirt: pickShirt("pass", detail),
    });

    // Same minute and place as the foul, pushed straight after it, so the
    // ticker reads "foul, then card" rather than the other way round.
    //
    // A second yellow emits BOTH cards, exactly as the referee shows them. That
    // is not a flourish: it makes the invariant exact, so the verifier can
    // assert `count(yellow) === yellows` and `count(red) === reds` rather than
    // reasoning about which bookings were somebody's second.
    const card = (outcome: "yellow" | "red") =>
      out.push({
        seq: 0, tick: state.tick + 1, minute, side: sideName,
        type: "card", outcome,
        x: where.x, y: where.y, xg: null, endX: null, endY: null, endZ: null,
        shirt: offender, secondaryShirt: null,
      });

    if (booked) card("yellow");
    if (red) card("red");
  }
}

/**
 * How much a side did this tick, before any of it is described.
 *
 * Drawn from the MAIN stream and always, collector or not, because possession
 * is now defined as pass share — which makes pass volume a match statistic
 * rather than a cosmetic detail. Tackle volume rides along with it so the sim's
 * counter can be asserted equal to `totalsFrom().tackles`.
 */
function drawPlay(
  side: SideState,
  dials: Dials,
  share: number,
  rng: () => number,
): { passes: number; tackles: number } {
  // You tackle when you haven't got the ball, and pressing decides how high.
  const tackles = poisson(
    BASE_TACKLES_PER_TICK * PRESSING_EFFECT[dials.pressing].fouls * ((1 - share) / 0.5),
    rng,
  );
  const passes = poisson(PASSES_PER_TICK * share, rng);

  side.passes += passes;
  side.tackles += tackles;
  return { passes, tackles };
}

/** Turns those counts into events. Positions and players only — no outcomes. */
function describePlay(
  sideName: Side,
  dials: Dials,
  play: { passes: number; tackles: number },
  state: MatchSimState,
  out: MatchEvent[],
) {
  const detail = state.detail;
  const tick = state.tick + 1;

  for (let i = 0; i < play.tackles; i++) {
    const where = tackleLocation(dials.pressing, detail);
    out.push({
      seq: 0, tick,
      minute: minuteWithinTick(tick, SIM_MINUTES_PER_TICK, detail),
      side: sideName, type: "tackle", outcome: "won",
      x: where.x, y: where.y, xg: null, endX: null, endY: null, endZ: null,
      shirt: pickShirt("tackle", detail), secondaryShirt: pickShirt("pass", detail),
    });
  }

  for (let i = 0; i < play.passes; i++) {
    const where = passLocation(dials.mentality, detail);
    const passer = pickShirt("pass", detail);
    out.push({
      seq: 0, tick,
      minute: minuteWithinTick(tick, SIM_MINUTES_PER_TICK, detail),
      side: sideName, type: "pass",
      // Passes get harder the further up the pitch they are played.
      outcome: detail() < 0.88 - 0.25 * (where.x / 100) ? "complete" : "incomplete",
      x: where.x, y: where.y, xg: null, endX: null, endY: null, endZ: null,
      shirt: passer, secondaryShirt: pickShirt("pass", detail),
    });
  }
}

/**
 * Advances one tick. Mutates and returns the state, so the room can hold a
 * single object and the harness can loop cheaply.
 *
 * Pass `collect` to receive this tick's events, already ordered by minute and
 * numbered contiguously from the previous tick's last `seq`.
 */
export function simulateTick(
  state: MatchSimState,
  homeDials: Dials,
  awayDials: Dials,
  rng: () => number,
  collect?: MatchEvent[],
): MatchSimState {
  const share = possessionShare(homeDials, awayDials);
  const produced: Collector = collect ? [] : undefined;

  takeShots(state.home, state.away, "home", homeDials, awayDials, share, rng, state, produced);
  takeShots(state.away, state.home, "away", awayDials, homeDials, 1 - share, rng, state, produced);

  commitFouls(state.home, "home", homeDials, share, rng, state, produced);
  commitFouls(state.away, "away", awayDials, 1 - share, rng, state, produced);

  const homePlay = drawPlay(state.home, homeDials, share, rng);
  const awayPlay = drawPlay(state.away, awayDials, 1 - share, rng);

  if (produced) {
    describePlay("home", homeDials, homePlay, state, produced);
    describePlay("away", awayDials, awayPlay, state, produced);

    // Stable sort, so a card still follows the foul that caused it even though
    // the two share a minute.
    produced.sort((a, b) => a.minute - b.minute);
    for (const event of produced) {
      event.seq = state.seq++;
      collect!.push(event);
    }
  }

  state.tick += 1;
  return state;
}

export type MatchResult = {
  home: SideState;
  away: SideState;
  /** Home possession as a percentage, rounded. */
  homePossession: number;
  events: MatchEvent[];
};

/** Plays a whole match. Dials are fixed for the run — the room varies them live. */
export function simulateMatch(
  homeDials: Dials = DEFAULT_DIALS,
  awayDials: Dials = DEFAULT_DIALS,
  seed = 1,
  collectEvents = false,
): MatchResult {
  const state = newMatch(seed);
  const rng = makeRng(seed);
  const events: MatchEvent[] = [];
  for (let i = 0; i < TICKS_PER_MATCH; i++) {
    simulateTick(state, homeDials, awayDials, rng, collectEvents ? events : undefined);
  }
  return {
    home: state.home,
    away: state.away,
    homePossession: possessionPercent(state.home, state.away),
    events,
  };
}
