/**
 * Everything the post-match summary shows, derived from `match_event` alone.
 *
 * This is the AGENTS.md design rule made into a module: the shot map, the stat
 * card, the xG race, the timeline and the top-performer strip are all folds over
 * one array of rows. Nothing on that page reads a second table, which is exactly
 * what the Phase 05 exit criterion asks for — and the reason a new stat should
 * be added here before anyone reaches for a new column.
 *
 * ── On the duplication with the match server ────────────────────────────────
 *
 * `totalsFrom` deliberately mirrors `server/src/sim/events.ts`. The two packages
 * are separate deployments that share no code, the same way lib/match-ticket.ts
 * and lib/force-ipv4.ts are mirrored. The server's copy exists to VERIFY the log
 * against the sim; this copy exists to DISPLAY it.
 *
 * They are kept honest by the database rather than by discipline: the match row
 * stores the aggregates the server derived, and `npm run match:check` asserts
 * that this implementation reproduces them from the events of real, finished
 * matches. A drift between the two is a failing script, not a wrong number
 * nobody notices.
 */

export type Side = "home" | "away";
export type EventType = "shot" | "pass" | "tackle" | "card" | "sub";

export type MatchEventRow = {
  seq: number;
  tick: number;
  minute: number;
  side: Side;
  type: EventType;
  outcome: string;
  x: number;
  y: number;
  xg: number | null;
  /** Shots only — where the ball's flight ended. Null before Phase 05. */
  endX: number | null;
  endY: number | null;
  /** Height in metres at that point; above 2.44 cleared the bar. */
  endZ: number | null;
  shirt: number;
  secondaryShirt: number | null;
};

/* ── Team totals ──────────────────────────────────────────────────────────── */

export type SideTotals = {
  shots: number;
  onTarget: number;
  goals: number;
  xg: number;
  passes: number;
  passesCompleted: number;
  tackles: number;
  fouls: number;
  yellows: number;
  reds: number;
};

export function totalsFrom(events: MatchEventRow[], side: Side): SideTotals {
  const t: SideTotals = {
    shots: 0, onTarget: 0, goals: 0, xg: 0,
    passes: 0, passesCompleted: 0, tackles: 0, fouls: 0, yellows: 0, reds: 0,
  };

  for (const e of events) {
    if (e.side !== side) continue;
    t.xg += e.xg ?? 0;
    switch (e.type) {
      case "shot":
        t.shots++;
        // A goal is on target too — it is the most on-target a shot can be.
        if (e.outcome === "goal" || e.outcome === "saved") t.onTarget++;
        if (e.outcome === "goal") t.goals++;
        break;
      case "pass":
        t.passes++;
        if (e.outcome === "complete") t.passesCompleted++;
        break;
      case "tackle":
        t.tackles++;
        if (e.outcome === "foul") t.fouls++;
        break;
      case "card":
        if (e.outcome === "yellow") t.yellows++;
        else t.reds++;
        break;
    }
  }

  return t;
}

/**
 * Possession, as pass share.
 *
 * The single definition of possession in the product — the match server computes
 * it exactly this way when it writes `match.home_possession`, so the stored
 * column and this number are the same number rather than two estimates of it.
 * See docs/features/03-event-stream.md.
 */
export function possessionPercent(home: SideTotals, away: SideTotals): number {
  const total = home.passes + away.passes;
  return total === 0 ? 50 : Math.round((home.passes / total) * 100);
}

export function passAccuracy(totals: SideTotals): number {
  return totals.passes === 0
    ? 0
    : Math.round((totals.passesCompleted / totals.passes) * 100);
}

/* ── Shot map ─────────────────────────────────────────────────────────────── */

export type Shot = {
  seq: number;
  side: Side;
  minute: number;
  x: number;
  y: number;
  xg: number;
  outcome: string;
  shirt: number;
  assist: number | null;
  /**
   * Where the ball ended up. Null for matches played before placement was
   * recorded — those cannot be backfilled, because where the ball went was
   * never observed. The map draws a dot without a trajectory and says so.
   */
  endX: number | null;
  endY: number | null;
  endZ: number | null;
};

export function shotsFrom(events: MatchEventRow[]): Shot[] {
  return events
    .filter((e) => e.type === "shot")
    .map((e) => ({
      seq: e.seq, side: e.side, minute: e.minute,
      x: e.x, y: e.y, xg: e.xg ?? 0,
      outcome: e.outcome, shirt: e.shirt, assist: e.secondaryShirt,
      endX: e.endX, endY: e.endY, endZ: e.endZ,
    }));
}

/* ── xG race ──────────────────────────────────────────────────────────────── */

export type RacePoint = {
  minute: number;
  home: number;
  away: number;
  /** Set when a goal was scored at this minute, so the chart can mark it. */
  goal?: Side;
};

/**
 * Cumulative xG per side against the clock.
 *
 * A step line, not a smooth one: xG only moves when a shot is taken, so a flat
 * stretch genuinely means a quiet spell. Interpolating between shots would draw
 * a chance that never happened.
 */
export function xgRace(events: MatchEventRow[], fullTimeMinute = 90): RacePoint[] {
  const points: RacePoint[] = [{ minute: 0, home: 0, away: 0 }];
  let home = 0;
  let away = 0;

  for (const e of events) {
    if (e.type !== "shot") continue;
    if (e.side === "home") home += e.xg ?? 0;
    else away += e.xg ?? 0;

    const goal = e.outcome === "goal" ? e.side : undefined;
    const last = points[points.length - 1];
    // Several shots can share a minute. Keep one point per minute, but never
    // let it swallow a goal marker.
    if (last.minute === e.minute && !last.goal) {
      last.home = round2(home);
      last.away = round2(away);
      if (goal) last.goal = goal;
    } else {
      points.push({ minute: e.minute, home: round2(home), away: round2(away), goal });
    }
  }

  // Carry the final totals to the whistle so the line doesn't stop early.
  points.push({ minute: fullTimeMinute, home: round2(home), away: round2(away) });
  return points;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ── Timeline ─────────────────────────────────────────────────────────────── */

export type Moment = {
  seq: number;
  minute: number;
  side: Side;
  kind: "goal" | "yellow" | "red";
  shirt: number;
  assist: number | null;
};

/**
 * Goals and cards only. The full ticker belongs to the live view — a post-match
 * timeline that lists three hundred passes is a log file, not a summary.
 */
export function keyMoments(events: MatchEventRow[]): Moment[] {
  const moments: Moment[] = [];
  for (const e of events) {
    if (e.type === "shot" && e.outcome === "goal") {
      moments.push({
        seq: e.seq, minute: e.minute, side: e.side,
        kind: "goal", shirt: e.shirt, assist: e.secondaryShirt,
      });
    } else if (e.type === "card") {
      moments.push({
        seq: e.seq, minute: e.minute, side: e.side,
        kind: e.outcome === "red" ? "red" : "yellow",
        shirt: e.shirt, assist: null,
      });
    }
  }
  return moments;
}

/* ── Top performers ───────────────────────────────────────────────────────── */

export type PlayerLine = {
  shirt: number;
  goals: number;
  assists: number;
  shots: number;
  xg: number;
  tackles: number;
  yellows: number;
  reds: number;
};

/**
 * A side's players, keyed by shirt and ranked by how much they did.
 *
 * Shirt numbers are the identifier until Phase 09 brings real squads; Phase 10
 * fills `player_id` in alongside them, and this function keeps working with a
 * one-line change to the key. That continuity is the whole reason events carry
 * both.
 */
export function playerLines(events: MatchEventRow[], side: Side): PlayerLine[] {
  const byShirt = new Map<number, PlayerLine>();
  const get = (shirt: number) => {
    let line = byShirt.get(shirt);
    if (!line) {
      line = { shirt, goals: 0, assists: 0, shots: 0, xg: 0, tackles: 0, yellows: 0, reds: 0 };
      byShirt.set(shirt, line);
    }
    return line;
  };

  for (const e of events) {
    if (e.side !== side) continue;
    switch (e.type) {
      case "shot": {
        const line = get(e.shirt);
        line.shots++;
        line.xg += e.xg ?? 0;
        if (e.outcome === "goal") {
          line.goals++;
          // Only a goal earns an assist. A key pass into a saved shot is a
          // different stat, and inventing it here would be inventing data.
          if (e.secondaryShirt !== null) get(e.secondaryShirt).assists++;
        }
        break;
      }
      case "tackle":
        if (e.outcome === "won") get(e.shirt).tackles++;
        break;
      case "card":
        if (e.outcome === "red") get(e.shirt).reds++;
        else get(e.shirt).yellows++;
        break;
    }
  }

  // Goals first, then assists, then chance quality — the order a reader ranks
  // a match in their head.
  return [...byShirt.values()].sort(
    (a, b) =>
      b.goals - a.goals ||
      b.assists - a.assists ||
      b.xg - a.xg ||
      b.tackles - a.tackles ||
      a.shirt - b.shirt,
  );
}
