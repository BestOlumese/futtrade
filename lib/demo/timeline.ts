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
 * The passage is four ACTS, each ending in a goal, a celebration and a fresh
 * kickoff. Only the last goal gets a full slow-motion hold, or celebrations
 * would eat a third of the loop.
 *
 * ── Two clocks ────────────────────────────────────────────────────────────
 *
 * Real loop time advances continuously. PLAY time freezes during kickoffs, every
 * stoppage (booking, free kick, penalty) and every celebration. `playClockAt`
 * maps real → play, `realTimeOf` inverts it. Beats live in play time; phases,
 * set-piece staging and the price live in real time.
 *
 * `matchStateAt` is pure, so server and client render identically, a section
 * scrolled back into view is instantly in sync, and state at LOOP_MS equals
 * state at 0 — the loop closes on a kickoff.
 *
 * None of this is real data, and it is deliberately not wired to a live match:
 * the landing page has to work when nothing is in progress.
 */

export const LOOP_MS = 150_000;

const MATCH_SPEED = 13; // match seconds per second of PLAY time
const MATCH_START_SECOND = 64 * 60 + 12;

export const HOME = { name: "Kestrel FC", short: "KES" };
export const AWAY = { name: "Ardor SC", short: "ARD" };
export const TRACKED_PLAYER = "A. Delane";

export type Team = "home" | "away";
export type Point = { x: number; y: number };

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

/* ── Goal geometry ───────────────────────────────────────────────────────────
   Seen from above, so a goal is a shallow box behind the goal line rather than
   posts and a crossbar. Exported because the renderer draws the frame from the
   same numbers the ball is aimed at — otherwise a shot could land beside a post
   that's drawn somewhere else.
   ──────────────────────────────────────────────────────────────────────────*/

/**
 * Pitch geometry, to scale.
 *
 * Coordinates are 0–100 across the PLAYING AREA in both axes, so x and y have
 * different metre scales (105m over 100 x-units, 68m over 100 y-units). That
 * matters: a circle on the grass is an ellipse in these coordinates, which is
 * why the arc radii below differ.
 *
 * The goal lines are the playing-area edges (x = 0 and x = 100) and the nets sit
 * outside them, as on a real diagram. An earlier version put the goal line at
 * x = 97 with pitch behind it, and drew the penalty area from x = 86 to 100 —
 * so the box overlapped the goal and ran past the line, and the penalty spot was
 * measured off nothing.
 */
const M_PER_X = 105 / 100;
const M_PER_Y = 68 / 100;
const YARD_M = 0.9144;

export const PITCH = {
  lengthM: 105,
  widthM: 68,
  netDepthM: 2,
  /** Along the pitch, from a goal line. */
  penaltyAreaDepth: 16.5 / M_PER_X, // 15.71
  sixYardDepth: 5.5 / M_PER_X, // 5.24
  penaltySpotDepth: 11 / M_PER_X, // 10.48
  netDepth: 2 / M_PER_X, // 1.90
  /** Across the pitch, from the centre line. */
  goalHalfWidth: 7.32 / 2 / M_PER_Y, // 5.38
  penaltyAreaHalfWidth: 40.32 / 2 / M_PER_Y, // 29.65
  sixYardHalfWidth: 18.32 / 2 / M_PER_Y, // 13.47
  /** 9.15m, which is an ellipse in these coordinates. */
  arcRx: 9.15 / M_PER_X, // 8.71
  arcRy: 9.15 / M_PER_Y, // 13.46
  cornerRx: 1 / M_PER_X,
  cornerRy: 1 / M_PER_Y,
};

export const GOAL = {
  yTop: 50 - PITCH.goalHalfWidth, // 44.62
  yBottom: 50 + PITCH.goalHalfWidth, // 55.38
  lineLeft: 0,
  lineRight: 100,
};

/** Distance from a goal line, in yards, as an x coordinate. */
export function yardsFromGoal(yards: number, end: "left" | "right"): number {
  const units = (yards * YARD_M) / M_PER_X;
  return end === "right" ? 100 - units : units;
}

/** Where the ball comes to rest in the net. */
const NET_REST = PITCH.netDepth * 0.55; // ~1.05 units past the line

export const PENALTY_SPOT_RIGHT: Point = {
  x: 100 - PITCH.penaltySpotDepth,
  y: 50,
};

/* ── Acts ────────────────────────────────────────────────────────────────── */

type Act = {
  kickoff: [number, number];
  play: [number, number];
  /** Play time is frozen inside each of these. */
  stoppages: [number, number][];
  /** Real ms at which the ball hits the net. Equals play[1]. */
  goalAt: number;
  slowmoMs: number;
  walkbackEnd: number;
};

const ACTS: Act[] = [
  {
    kickoff: [0, 2_500], play: [2_500, 34_000], stoppages: [],
    goalAt: 34_000, slowmoMs: 1_200, walkbackEnd: 38_000,
  },
  {
    kickoff: [40_000, 42_000], play: [42_000, 76_000],
    // Booking, then the free-kick staging that produces the second goal.
    stoppages: [[52_000, 54_000], [71_000, 74_500]],
    goalAt: 76_000, slowmoMs: 1_200, walkbackEnd: 80_000,
  },
  {
    kickoff: [82_000, 84_000], play: [84_000, 112_000], stoppages: [],
    goalAt: 112_000, slowmoMs: 1_200, walkbackEnd: 116_000,
  },
  {
    kickoff: [118_000, 120_000], play: [120_000, 142_000],
    stoppages: [[136_000, 140_000]], // penalty staging
    goalAt: 142_000, slowmoMs: 3_000, walkbackEnd: 148_000,
  },
];

function actPlayMs(act: Act): number {
  const stopped = act.stoppages.reduce((s, [a, b]) => s + (b - a), 0);
  return act.play[1] - act.play[0] - stopped;
}

export const PLAY_TOTAL = ACTS.reduce((s, a) => s + actPlayMs(a), 0); // 106_000

export type Phase =
  | "kickoff" | "play" | "stoppage" | "slowmo" | "walkback" | "set";

export function phaseAt(t: number): Phase {
  for (const act of ACTS) {
    if (t < act.kickoff[0]) return "set";
    if (t < act.kickoff[1]) return "kickoff";
    // Strictly before the goal: AT the goal the ball is already in the net, so
    // that instant belongs to the celebration.
    if (t < act.goalAt) {
      for (const [s0, s1] of act.stoppages) {
        if (t >= s0 && t <= s1) return "stoppage";
      }
      return "play";
    }
    if (t < act.goalAt + act.slowmoMs) return "slowmo";
    if (t < act.walkbackEnd) return "walkback";
  }
  return "set";
}

function actAt(t: number): Act {
  for (const act of ACTS) if (t < act.walkbackEnd) return act;
  return ACTS[ACTS.length - 1];
}

export function playClockAt(t: number): number {
  let acc = 0;
  for (const act of ACTS) {
    if (t < act.kickoff[1]) return acc;
    const total = actPlayMs(act);
    if (t < act.goalAt) {
      let cursor = act.play[0];
      let within = 0;
      for (const [s0, s1] of act.stoppages) {
        if (t < s0) return acc + within + (t - cursor);
        within += s0 - cursor;
        if (t <= s1) return acc + within;
        cursor = s1;
      }
      return acc + within + (t - cursor);
    }
    acc += total;
    if (t < act.walkbackEnd) return acc;
  }
  return acc;
}

/** Inverse. Inside a stoppage it returns the moment play STOPPED — which is when
 *  the foul happened, the useful answer for scheduling. */
export function realTimeOf(playTime: number): number {
  let acc = 0;
  for (const act of ACTS) {
    const total = actPlayMs(act);
    if (playTime <= acc + total) {
      let within = playTime - acc;
      let cursor = act.play[0];
      for (const [s0, s1] of act.stoppages) {
        const seg = s0 - cursor;
        if (within <= seg) return cursor + within;
        within -= seg;
        cursor = s1;
      }
      return cursor + within;
    }
    acc += total;
  }
  return LOOP_MS;
}

const SETTLE_RAMP_MS = 2_000;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

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
  | "kickoff" | "pass" | "tackle" | "save" | "block"
  | "goalkick" | "freekick" | "penalty" | "goal";

type Beat = {
  at: number; // play ms
  team: Team;
  idx: number;
  via: Arrival;
  action: "pass" | "shot" | "foul";
  shot?: {
    outcome: ShotOutcome;
    xg: number;
    /** How it was struck — shown on the goal badge. */
    note: string;
    /** Where in the frame it finished — also shown on the badge. */
    placement?: string;
    /** Exact landing point. The drawn line ends here too. */
    target?: Point;
    /** Where it is struck FROM. The shooter runs here before striking, so the
     *  stated distance is the distance actually shot from. */
    from?: Point;
    distanceYards?: number;
    /** Perpendicular bend: a curled, dipped or whipped strike. */
    bend?: number;
    priceStep?: number;
    /** Keeper commits the wrong way. */
    keeperWrongWay?: boolean;
  };
  foulBy?: {
    team: Team;
    idx: number;
    reason: string;
    card?: "yellow" | "red";
    awards?: "freekick" | "penalty";
    /** The carrier runs here, so the foul genuinely happens at this point. */
    spot?: Point;
  };
  note?: { type: "Sub"; detail: string };
};

const SHOT_MS = 450;
const RECOVER_MS = 750;
const PASS_FLIGHT_MS = 600;

const G1 = 31_500;
const G2 = 60_000;
const G3 = 88_000;
const G4 = PLAY_TOTAL; // 106_000
const CARD_FOUL = 41_500;
const FK_FOUL = 58_500;
const PEN_FOUL = 104_000;

/**
 * Where fouls happen. The free kick is taken from exactly this point; the
 * penalty is taken from the real penalty spot regardless, as in the laws.
 * Both are reached by the carrier genuinely running there, not by teleporting.
 */
const FK_FOUL_SPOT: Point = { x: yardsFromGoal(22, "right"), y: 41 };
const PEN_FOUL_SPOT: Point = { x: yardsFromGoal(9, "right"), y: 47 };

/** In the net, at the target's height. */
function inNet(y: number): Point {
  return { x: 100 + NET_REST, y };
}

const BEATS: Beat[] = [
  /* ── Act 1 — build-up to a curled finish ── */
  { at: 0, team: "home", idx: 6, via: "kickoff", action: "pass" },
  { at: 2_000, team: "home", idx: 2, via: "pass", action: "pass" },
  { at: 4_000, team: "away", idx: 8, via: "tackle", action: "pass" },
  { at: 6_000, team: "home", idx: 5, via: "tackle", action: "pass" },
  { at: 8_000, team: "home", idx: 6, via: "pass", action: "pass" },
  { at: 10_000, team: "home", idx: 7, via: "pass", action: "pass" },
  {
    at: 12_000, team: "home", idx: 8, via: "pass", action: "shot",
    shot: {
      outcome: "blocked", xg: 0.09, note: "blocked", priceStep: 0.02,
      from: { x: yardsFromGoal(20, "right"), y: 40 }, distanceYards: 20,
    },
  },
  { at: 14_500, team: "away", idx: 3, via: "block", action: "pass" },
  { at: 16_500, team: "away", idx: 6, via: "pass", action: "pass" },
  {
    at: 18_500, team: "away", idx: 9, via: "pass", action: "shot",
    shot: {
      outcome: "saved", xg: 0.31, note: "low to the right",
      from: { x: yardsFromGoal(14, "left"), y: 55 }, distanceYards: 14,
    },
  },
  { at: 21_000, team: "home", idx: 0, via: "save", action: "pass" },
  { at: 23_000, team: "home", idx: 3, via: "pass", action: "pass" },
  { at: 25_000, team: "home", idx: 6, via: "pass", action: "pass" },
  { at: 27_000, team: "home", idx: 10, via: "pass", action: "pass" },
  {
    at: 29_000, team: "home", idx: 9, via: "pass", action: "shot",
    shot: {
      outcome: "goal", xg: 0.44, note: "curled with the left foot",
      placement: "far corner", distanceYards: 18,
      from: { x: yardsFromGoal(18, "right"), y: 63 },
      target: inNet(45.8), bend: -7, priceStep: 0.27,
    },
  },
  { at: G1, team: "home", idx: 9, via: "goal", action: "pass" },

  /* ── Act 2 — a booking, then a free kick ── */
  { at: G1, team: "away", idx: 6, via: "kickoff", action: "pass" },
  { at: 33_500, team: "away", idx: 5, via: "pass", action: "pass" },
  { at: 35_500, team: "home", idx: 7, via: "tackle", action: "pass" },
  {
    at: 37_500, team: "home", idx: 5, via: "pass", action: "pass",
    note: { type: "Sub", detail: "Renn on for Kavan" },
  },
  {
    at: 39_500, team: "home", idx: 8, via: "pass", action: "foul",
    foulBy: {
      team: "away", idx: 5, reason: "dissent", card: "yellow",
      spot: { x: 58, y: 30 },
    },
  },
  { at: CARD_FOUL, team: "home", idx: 8, via: "freekick", action: "pass" },
  { at: 43_500, team: "home", idx: 6, via: "pass", action: "pass" },
  { at: 45_500, team: "home", idx: 10, via: "pass", action: "pass" },
  { at: 47_500, team: "home", idx: 5, via: "pass", action: "pass" },
  { at: 49_500, team: "home", idx: 7, via: "pass", action: "pass" },
  { at: 51_500, team: "home", idx: 8, via: "pass", action: "pass" },
  { at: 53_500, team: "home", idx: 6, via: "pass", action: "pass" },
  { at: 55_500, team: "home", idx: 10, via: "pass", action: "pass" },
  {
    at: 57_000, team: "home", idx: 9, via: "pass", action: "foul",
    foulBy: {
      team: "away", idx: 3, reason: "trip on the edge of the box",
      awards: "freekick", spot: FK_FOUL_SPOT,
    },
  },
  {
    // Taken from exactly where the foul happened.
    at: FK_FOUL, team: "home", idx: 9, via: "freekick", action: "shot",
    shot: {
      outcome: "goal", xg: 0.28, note: "free kick, over the wall",
      placement: "far corner", distanceYards: 22,
      from: FK_FOUL_SPOT, target: inNet(54.4), bend: 8, priceStep: 0.22,
    },
  },
  { at: G2, team: "home", idx: 9, via: "goal", action: "pass" },

  /* ── Act 3 — Ardor push, then a strike from distance ── */
  { at: G2, team: "away", idx: 6, via: "kickoff", action: "pass" },
  {
    at: 62_000, team: "away", idx: 9, via: "pass", action: "shot",
    shot: {
      outcome: "saved", xg: 0.22, note: "tipped over",
      from: { x: yardsFromGoal(16, "left"), y: 46 }, distanceYards: 16,
    },
  },
  { at: 64_500, team: "home", idx: 0, via: "save", action: "pass" },
  { at: 66_500, team: "home", idx: 3, via: "pass", action: "pass" },
  { at: 68_500, team: "home", idx: 5, via: "pass", action: "pass" },
  { at: 70_500, team: "home", idx: 7, via: "pass", action: "pass" },
  {
    at: 72_500, team: "home", idx: 8, via: "pass", action: "shot",
    shot: {
      outcome: "off", xg: 0.12, note: "wide", priceStep: 0.03,
      from: { x: yardsFromGoal(24, "right"), y: 56 }, distanceYards: 24,
    },
  },
  { at: 75_000, team: "away", idx: 0, via: "goalkick", action: "pass" },
  { at: 77_000, team: "away", idx: 5, via: "pass", action: "pass" },
  { at: 79_000, team: "away", idx: 6, via: "pass", action: "pass" },
  { at: 81_000, team: "home", idx: 6, via: "tackle", action: "pass" },
  { at: 83_000, team: "home", idx: 5, via: "pass", action: "pass" },
  {
    at: 85_500, team: "home", idx: 6, via: "pass", action: "shot",
    shot: {
      outcome: "goal", xg: 0.07, note: "struck from distance",
      placement: "inside the post", distanceYards: 25,
      from: { x: yardsFromGoal(25, "right"), y: 50 },
      target: inNet(45.4), bend: 4, priceStep: 0.19,
    },
  },
  { at: G3, team: "home", idx: 6, via: "goal", action: "pass" },

  /* ── Act 4 — a penalty ── */
  { at: G3, team: "away", idx: 6, via: "kickoff", action: "pass" },
  { at: 90_000, team: "away", idx: 5, via: "pass", action: "pass" },
  { at: 92_000, team: "home", idx: 7, via: "tackle", action: "pass" },
  { at: 94_000, team: "home", idx: 5, via: "pass", action: "pass" },
  { at: 96_000, team: "home", idx: 8, via: "pass", action: "pass" },
  { at: 98_000, team: "home", idx: 10, via: "pass", action: "pass" },
  { at: 100_000, team: "home", idx: 6, via: "pass", action: "pass" },
  {
    at: 102_000, team: "home", idx: 9, via: "pass", action: "foul",
    foulBy: {
      team: "away", idx: 2, reason: "clumsy challenge in the area",
      awards: "penalty", spot: PEN_FOUL_SPOT,
    },
  },
  {
    // Taken from the penalty spot, wherever in the area the foul happened —
    // as in the laws.
    at: PEN_FOUL, team: "home", idx: 9, via: "penalty", action: "shot",
    shot: {
      outcome: "goal", xg: 0.79, note: "penalty",
      placement: "keeper sent the wrong way", distanceYards: 12,
      from: PENALTY_SPOT_RIGHT, target: inNet(53.9),
      priceStep: 0.31, keeperWrongWay: true,
    },
  },
  { at: G4, team: "home", idx: 9, via: "goal", action: "pass" },
];

function beatAt(playTime: number) {
  let i = 0;
  for (let k = 0; k < BEATS.length - 1; k++) if (BEATS[k].at <= playTime) i = k;
  return {
    beat: BEATS[i],
    next: BEATS[i + 1] ?? BEATS[0],
    prev: i > 0 ? BEATS[i - 1] : undefined,
  };
}

function shotFireTime(beat: Beat, next: Beat): number {
  return beat.shot?.outcome === "goal"
    ? next.at - SHOT_MS
    : next.at - RECOVER_MS - SHOT_MS;
}

/* ── Derived events ──────────────────────────────────────────────────────── */

export type EventType = "Shot" | "Save" | "Goal" | "Card" | "Sub" | "Tackle" | "Foul";

export type DerivedEvent = {
  at: number;
  type: EventType;
  detail: string;
  xg?: number;
  isShot?: boolean;
  priceStep?: number;
  impulse?: number;
  scores?: boolean;
  card?: "yellow" | "red";
};

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
      const f = beat.foulBy;
      const who = nameOf(f.team, f.idx);
      out.push({
        at: realTimeOf(next.at),
        type: f.card ? "Card" : "Foul",
        // Spelled out, so the row reads correctly even without the colour chip.
        detail: f.card
          ? `${f.card === "yellow" ? "Yellow card" : "Red card"} · ${who} · ${f.reason}`
          : `${who} · ${f.reason}${f.awards === "penalty" ? " · penalty" : ""}`,
        card: f.card,
        impulse: f.team === "away" ? 12 : -12,
      });
    }
  });

  return out.sort((a, b) => a.at - b.at);
})();

const GOAL_BEATS = BEATS.filter((b) => b.shot?.outcome === "goal");
const CARD_BEAT = BEATS.find((b) => b.foulBy?.card)!;

/* ── Set pieces ──────────────────────────────────────────────────────────── */

export type SetPiece = {
  kind: "penalty" | "freekick";
  label: string;
  spot: Point;
  /** 0 → 1 as the players get into position. */
  staged: number;
};

const FK_BEAT = BEATS.find((b) => b.via === "freekick" && b.action === "shot")!;
const PEN_BEAT = BEATS.find((b) => b.via === "penalty")!;

/**
 * Active from the moment play stops until the ball is struck.
 *
 * The spot is the taker's own strike point, so the tag, the wall and the ball
 * are all placed off one value. For the free kick that point is where the foul
 * happened; for the penalty it is the penalty spot, as in the laws.
 */
function setPieceAt(t: number): SetPiece | null {
  const act = actAt(t);
  for (const [s0] of act.stoppages) {
    // Only the stoppage immediately preceding this act's goal stages a set
    // piece; the booking earlier in act 2 does not.
    const penalty = act === ACTS[3] && s0 === 136_000;
    const freekick = act === ACTS[1] && s0 === 71_000;
    if (!penalty && !freekick) continue;
    if (t >= s0 && t < act.goalAt) {
      const beat = penalty ? PEN_BEAT : FK_BEAT;
      return {
        kind: penalty ? "penalty" : "freekick",
        label: penalty ? "Penalty" : "Free kick",
        spot: beat.shot!.from!,
        staged: clamp((t - s0) / 900, 0, 1),
      };
    }
  }
  return null;
}

/* ── Formations and per-player character ─────────────────────────────────── */

/** Keepers sit just off their goal line, inside the six-yard box. */
const HOME_SHAPE: [number, number][] = [
  [2.5, 50],
  [19, 18], [19, 40], [19, 60], [19, 82],
  [36, 28], [36, 50], [36, 72],
  [55, 20], [55, 50], [55, 80],
];

const AWAY_SHAPE: [number, number][] = [
  [97.5, 50],
  [81, 18], [81, 40], [81, 60], [81, 82],
  [64, 28], [64, 50], [64, 72],
  [45, 24], [45, 50], [45, 76],
];

type Role = "GK" | "CB" | "FB" | "CM" | "WING" | "ST";
const ROLES: Role[] = [
  "GK", "FB", "CB", "CB", "FB", "CM", "CM", "CM", "WING", "ST", "WING",
];

const ROLE_MOTION: Record<
  Role, { ax: number; ay: number; freq: number; burst: number; shift: number }
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

function shapeFor(team: Team): [number, number][] {
  return team === "home" ? HOME_SHAPE : AWAY_SHAPE;
}

function lerp(a: Point, b: Point, p: number): Point {
  return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
}

function focusAt(playTime: number): Point {
  const { beat, next } = beatAt(playTime);
  const a = shapeFor(beat.team)[beat.idx];
  const b = shapeFor(next.team)[next.idx];
  const span = next.at - beat.at || 1;
  const p = clamp((playTime - beat.at) / span, 0, 1);
  const eased = p * p * (3 - 2 * p);
  return { x: a[0] + (b[0] - a[0]) * eased, y: a[1] + (b[1] - a[1]) * eased };
}

function basePlayers(t: number, team: Team): Point[] {
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
    const burst = motion.burst * Math.pow(Math.max(0, burstWave), 3) * attack * energy;

    return {
      x: clamp(bx + blockX * motion.shift + driftX + burst, 2.5, 97.5),
      y: clamp(by + blockY * motion.shift + driftY, 4, 96),
    };
  });
}

const APPROACH_MS = 1_400;

/**
 * The run-up. Blends a player onto a scripted point over the moments before it
 * matters, so he arrives there by running rather than by being placed.
 *
 * Set-piece takers are handled by `applySetPiece` instead, which runs after this
 * and fully overrides — during a stoppage play time is frozen, so an approach
 * driven by play time would stall halfway.
 */
function applyApproach(
  home: Point[],
  away: Point[],
  beat: Beat,
  next: Beat,
  playTime: number,
  prev?: Beat,
): void {
  const mine = beat.team === "home" ? home : away;
  const ease = (p: number) => p * p * (3 - 2 * p);

  /* A restart begins where the offence ended. Without this the carrier's run-up
     stops the instant the beat changes and he snaps back to formation, so the
     ball appeared nowhere near the foul. `applySetPiece` then walks him on from
     here — a no-op for the free kick, since it's taken from that same spot, and
     a walk to the penalty spot for a penalty. */
  /* Whoever committed the foul stands over it. Without this the card and the
     "foul" appeared on a player who was nowhere near the challenge. */
  const placeOffender = (spot: Point, f: { team: Team; idx: number }, p: number) => {
    const theirs = f.team === "home" ? home : away;
    theirs[f.idx] = lerp(theirs[f.idx], { x: spot.x - 2.6, y: spot.y + 3.4 }, p);
  };

  if (
    (beat.via === "freekick" || beat.via === "penalty") &&
    prev?.foulBy?.spot
  ) {
    mine[beat.idx] = { ...prev.foulBy.spot };
    placeOffender(prev.foulBy.spot, prev.foulBy, 1);
    return;
  }

  if (beat.action === "shot" && beat.shot?.from) {
    const arriveBy = shotFireTime(beat, next);
    const p = clamp((playTime - (arriveBy - APPROACH_MS)) / APPROACH_MS, 0, 1);
    if (p > 0) mine[beat.idx] = lerp(mine[beat.idx], beat.shot.from, ease(p));
  }

  if (beat.action === "foul" && beat.foulBy?.spot) {
    const p = clamp((playTime - (next.at - APPROACH_MS)) / APPROACH_MS, 0, 1);
    if (p > 0) {
      mine[beat.idx] = lerp(mine[beat.idx], beat.foulBy.spot, ease(p));
      // The offender closes in as the challenge comes.
      placeOffender(beat.foulBy.spot, beat.foulBy, ease(p));
    }
  }
}

/** The away players who form a wall. */
const WALL_IDXS = [2, 3, 5, 6];

/**
 * Staging overrides. During a set piece the taker stands over the ball, the
 * keeper takes his line, a wall forms for a free kick, and the box empties for
 * a penalty. Blended in over `staged` so players walk into position.
 */
function applySetPiece(
  home: Point[],
  away: Point[],
  piece: SetPiece,
  taker: { team: Team; idx: number },
  target: Point,
): void {
  const p = piece.staged;
  const mine = taker.team === "home" ? home : away;
  const theirs = taker.team === "home" ? away : home;

  mine[taker.idx] = lerp(mine[taker.idx], piece.spot, p);
  theirs[0] = lerp(theirs[0], { x: GOAL.lineRight - 2, y: 50 }, p);

  if (piece.kind === "freekick") {
    const dx = target.x - piece.spot.x;
    const dy = target.y - piece.spot.y;
    const len = Math.hypot(dx, dy) || 1;
    const centre = {
      x: piece.spot.x + (dx / len) * 11,
      y: piece.spot.y + (dy / len) * 11,
    };
    const perp = { x: -dy / len, y: dx / len };
    WALL_IDXS.forEach((idx, k) => {
      const offset = (k - (WALL_IDXS.length - 1) / 2) * 3.2;
      theirs[idx] = lerp(
        theirs[idx],
        { x: centre.x + perp.x * offset, y: centre.y + perp.y * offset },
        p,
      );
    });
  } else {
    // Penalty: everyone except taker and keeper clears the box.
    const boxEdge = 100 - PITCH.penaltyAreaDepth; // the real edge of the area
    theirs.forEach((pt, idx) => {
      if (idx === 0) return;
      if (pt.x > boxEdge) theirs[idx] = lerp(pt, { x: boxEdge - 3, y: pt.y }, p);
    });
    mine.forEach((pt, idx) => {
      if (idx === taker.idx) return;
      if (pt.x > boxEdge) mine[idx] = lerp(pt, { x: boxEdge - 5, y: pt.y }, p);
    });
  }
}

/* ── Ball ────────────────────────────────────────────────────────────────── */

const CENTRE: Point = { x: 50, y: 50 };

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
  const shot = beat.shot!;
  if (shot.target) return shot.target;
  if (shot.outcome === "off") {
    // Wide of the post, past the goal line.
    return beat.team === "home"
      ? { x: 100 + NET_REST, y: GOAL.yTop - 7 }
      : { x: -NET_REST, y: GOAL.yBottom + 7 };
  }
  return collector;
}

type BallState = { x: number; y: number; inFlight: boolean };

function ballDuringPlay(playTime: number, home: Point[], away: Point[]): BallState {
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

/* ── Price and momentum ──────────────────────────────────────────────────── */

const BASE_PRICE = 4.82;

function eventsBefore(t: number): DerivedEvent[] {
  return EVENTS.filter((e) => e.at <= t);
}

function wobble(t: number): number {
  const s = t / 1000;
  return (
    Math.sin(s * 0.9) * 0.018 + Math.sin(s * 2.3 + 1.2) * 0.011 +
    Math.sin(s * 0.37 + 0.6) * 0.014
  );
}

export function priceAt(t: number): number {
  const stepped = eventsBefore(t).reduce((a, e) => a + (e.priceStep ?? 0), 0);
  return BASE_PRICE + stepped + wobble(t);
}

export const MOMENTUM_BARS = 36;
const MOMENTUM_SLICE_MS = LOOP_MS / MOMENTUM_BARS;

function momentumAt(t: number): number {
  const s = t / 1000;
  let value = Math.sin(s * 0.2) * 22 + Math.sin(s * 0.08 + 2) * 12;
  for (const e of EVENTS) {
    if (e.at > t || !e.impulse) continue;
    value += e.impulse * Math.exp(-(t - e.at) / 5500);
  }
  return clamp(value, -96, 96);
}

export type MomentumBar = { value: number; revealed: boolean; current: boolean };

/* ── State ───────────────────────────────────────────────────────────────── */

export type ShotLine = {
  x1: number; y1: number; x2: number; y2: number;
  cx: number; cy: number;
  outcome: ShotOutcome;
  xg: number;
  strength: number;
};

export type FeedRow = {
  minute: string;
  type: EventType;
  detail: string;
  xg?: number;
  card?: "yellow" | "red";
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
  feed: FeedRow[];
  momentum: MomentumBar[];
  momentumLeader: string;
  shotLine: ShotLine | null;
  card: { x: number; y: number; colour: "yellow" | "red" } | null;
  setPiece: SetPiece | null;
  goalBadge: {
    scorer: string; minute: string; score: string;
    note: string; placement?: string;
  } | null;
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

export const CANDLE_COUNT = 20;
const CANDLE_MS = LOOP_MS / CANDLE_COUNT;

export function matchStateAt(rawT: number): MatchState {
  const t = ((rawT % LOOP_MS) + LOOP_MS) % LOOP_MS;
  const phase = phaseAt(t);
  const playTime = playClockAt(t);
  const past = eventsBefore(t);
  const act = actAt(t);
  const { beat, next, prev } = beatAt(playTime);

  const homePlayers = basePlayers(t, "home");
  const awayPlayers = basePlayers(t, "away");

  /* Set-piece staging, before the ball is derived — the ball sits on the taker,
     and the taker is standing over the spot. */
  /* Run-up. A shooter reaches his strike point by running to it, and a carrier
     about to be fouled runs to the foul spot — so the stated distance is the
     distance actually shot from, and the free kick is taken from exactly where
     the challenge happened. Nothing teleports. */
  applyApproach(homePlayers, awayPlayers, beat, next, playTime, prev);

  const setPiece = setPieceAt(t);
  if (setPiece && beat.shot?.target) {
    applySetPiece(
      homePlayers, awayPlayers, setPiece,
      { team: beat.team, idx: beat.idx },
      beat.shot.target,
    );
  }

  /* Keeper reacts to a shot: he moves toward where it's heading, and is beaten
     the wrong way on the penalty. */
  if (beat.action === "shot" && beat.shot) {
    const fireAt = shotFireTime(beat, next);
    const lead = playTime - (fireAt - 250);
    if (lead > 0) {
      const collector = (next.team === "home" ? homePlayers : awayPlayers)[next.idx];
      const end = shotEndPoint(beat, collector);
      const keepers = beat.team === "home" ? awayPlayers : homePlayers;
      const line = beat.team === "home" ? GOAL.lineRight - 2 : GOAL.lineLeft + 2;
      const towards = beat.shot.keeperWrongWay ? 100 - end.y : end.y;
      const p = clamp(lead / (SHOT_MS + 250), 0, 1);
      keepers[0] = lerp(
        keepers[0],
        { x: line, y: clamp(towards, GOAL.yTop + 2, GOAL.yBottom - 2) },
        p,
      );
    }
  }

  /* Ball */
  let ball: BallState;
  if (phase === "kickoff" || phase === "set") {
    ball = { ...CENTRE, inFlight: false };
  } else if (phase === "slowmo") {
    const g = GOAL_BEATS[ACTS.indexOf(act)];
    ball = { ...(g?.shot?.target ?? inNet(50)), inFlight: false };
  } else if (phase === "walkback") {
    const g = GOAL_BEATS[ACTS.indexOf(act)];
    const from = act.goalAt + act.slowmoMs;
    const p = clamp((t - from) / (act.walkbackEnd - from), 0, 1);
    ball = {
      ...lerp(g?.shot?.target ?? inNet(50), CENTRE, p * p * (3 - 2 * p)),
      inFlight: false,
    };
  } else {
    ball = ballDuringPlay(playTime, homePlayers, awayPlayers);
  }

  /* Trail only while the ball is genuinely travelling in open play.
     Sampling it during a celebration looked back across the goal into the
     previous phase, leaving stray red dots out on the pitch while the ball sat
     in the net. */
  const ballTrail =
    phase === "play" && ball.inFlight
      ? [90, 190, 300]
          .map((back) => ({ back, at: (((t - back) % LOOP_MS) + LOOP_MS) % LOOP_MS }))
          // Each sample is kept only if the ball was also in open play then, so
          // a trail can never straddle a goal or a stoppage.
          .filter(({ at }) => phaseAt(at) === "play")
          .map(({ at }) => {
            const p = matchBallOnly(at);
            return { x: p.x, y: p.y };
          })
      : [];

  const inPlay = phase === "play" || phase === "stoppage";
  const holder = inPlay ? { team: beat.team, idx: beat.idx } : null;
  const tackle =
    inPlay && beat.via === "tackle" && playTime - beat.at < TACKLE_FLASH_MS
      ? { team: beat.team, idx: beat.idx }
      : null;

  /* Shot line — exists exactly while the ball travels it, along the same curve */
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

  const goalBeat = GOAL_BEATS[ACTS.indexOf(act)];
  if (phase === "slowmo" && goalBeat?.shot?.target) {
    /* The replay must retrace the shot that was actually taken. Recomputing the
       origin from `basePlayers` ignored the run-up and the set-piece staging,
       so the replay drew a second line from a different dot — most obviously on
       the free kick and penalty, where the taker had been placed on the spot. */
    const origin =
      goalBeat.shot.from ??
      basePlayers(realTimeOf(goalBeat.at), goalBeat.team)[goalBeat.idx];
    const end = goalBeat.shot.target;
    const c = controlPoint(origin, end, goalBeat.shot.bend ?? 0);
    shotLine = {
      x1: origin.x, y1: origin.y, x2: end.x, y2: end.y, cx: c.x, cy: c.y,
      outcome: "goal", xg: goalBeat.shot.xg, strength: 1,
    };
  }

  /* Card */
  let card: MatchState["card"] = null;
  const cardStoppage = ACTS[1].stoppages[0];
  if (t >= cardStoppage[0] && t < cardStoppage[1] + 1_200 && CARD_BEAT.foulBy) {
    const offender = (CARD_BEAT.foulBy.team === "home" ? homePlayers : awayPlayers)[
      CARD_BEAT.foulBy.idx
    ];
    card = { x: offender.x, y: offender.y, colour: CARD_BEAT.foulBy.card! };
  }

  const scored = ACTS.filter((a) => t >= a.goalAt).length;
  const inCelebration = t >= act.goalAt && t < act.walkbackEnd;
  const goalBadge =
    inCelebration && goalBeat?.shot
      ? {
          scorer: nameOf(goalBeat.team, goalBeat.idx),
          minute: minuteAt(act.goalAt),
          score: `${scored}–1`,
          note: goalBeat.shot.note,
          placement: goalBeat.shot.placement,
        }
      : null;

  const currentSlice = Math.floor(t / MOMENTUM_SLICE_MS);
  const momentum: MomentumBar[] = Array.from({ length: MOMENTUM_BARS }, (_, i) => ({
    value: momentumAt((i + 0.5) * MOMENTUM_SLICE_MS),
    revealed: i <= currentSlice,
    current: i === currentSlice,
  }));

  const price = priceAt(t);
  const lastPriceEvent = [...past].reverse().find((e) => e.priceStep);
  const nowMomentum = momentum[currentSlice]?.value ?? 0;

  return {
    phase,
    clock: formatClock(t),
    homeScore: scored,
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
      minute: minuteAt(e.at), type: e.type, detail: e.detail,
      xg: e.xg, card: e.card,
    })),
    momentum,
    momentumLeader: nowMomentum >= 0 ? HOME.name : AWAY.name,
    shotLine,
    card,
    setPiece,
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

/** Ball only, for the trail — avoids recomputing the whole state three times. */
function matchBallOnly(rawT: number): BallState {
  const t = ((rawT % LOOP_MS) + LOOP_MS) % LOOP_MS;
  const phase = phaseAt(t);
  const act = actAt(t);
  if (phase === "kickoff" || phase === "set") return { ...CENTRE, inFlight: false };
  const g = GOAL_BEATS[ACTS.indexOf(act)];
  const target = g?.shot?.target ?? inNet(50);
  if (phase === "slowmo") return { ...target, inFlight: false };
  if (phase === "walkback") {
    const from = act.goalAt + act.slowmoMs;
    const p = clamp((t - from) / (act.walkbackEnd - from), 0, 1);
    return { ...lerp(target, CENTRE, p * p * (3 - 2 * p)), inFlight: false };
  }
  return ballDuringPlay(playClockAt(t), basePlayers(t, "home"), basePlayers(t, "away"));
}

export { matchBallOnly as ballAt };

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
      open, close,
      high: Math.max(...samples, open, close),
      low: Math.min(...samples, open, close),
      live: isLive,
      spike: EVENTS.some((e) => e.scores && e.at >= startMs && e.at < endMs),
    };
  });
}
