"use client";

import { useState } from "react";
import type { Shot, Side } from "@/lib/match/derive";

/**
 * The shot map — one team at a time, with the trajectory of every shot.
 *
 * Both teams were overlaid on one goal at first. That was wrong in practice:
 * twenty-six shots on one half-pitch is a blob, and colour alone is a poor way
 * to answer "whose chance was that". A tab per side halves the density and makes
 * the question disappear.
 *
 * The trajectory is the point of the redesign. A dot says where a shot was
 * struck; the line says what happened to it — into the net, held on the line,
 * charged down after four metres, dragged past the post. That is derived from
 * `end_x`/`end_y`/`end_z` on the event, not invented here: see
 * docs/features/03-event-stream.md § Shot placement.
 *
 * Encoding:
 *   line     what became of the shot, and where it ended
 *   radius   xG — capped small, because the line now carries the outcome
 *   colour   team, and only team
 *
 * Colour is never the only signal: line style and end point carry the outcome,
 * so the map reads without separating lime from white.
 *
 * SVG rather than canvas — a few dozen marks, crisp at any size, titled for a
 * screen reader, themed with the same tokens as everything else. Phaser is for
 * the moving pitch in Phase 06.
 */

const PITCH_X_M = 105;
const PITCH_Y_M = 68;
/** Events are on a 0–100 scale for both axes, but a pitch is 105 m by 68 m. */
const toX = (x: number) => (x * PITCH_X_M) / 100;
const toY = (y: number) => (y * PITCH_Y_M) / 100;

/** The attacking half plus a little of the middle third. */
const FROM_X_M = toX(48);
const CROSSBAR_M = 2.44;

/**
 * The viewBox is padded rather than left to `overflow: visible`.
 *
 * Two things sit outside the pitch rectangle: the boundary stroke, centred on
 * the edge so half of it falls outside, and an over-the-bar shot, which is drawn
 * past the goal line to show height. Letting those escape the element means they
 * paint over whatever the layout puts next to the map. Padding keeps them inside
 * the picture, where they belong.
 */
const PAD = 1.2;
/** Extra room on the right for a shot carried past the goal line. */
const OVERSHOOT = 3.4;
const VIEW_X = FROM_X_M - PAD;
const VIEW_W = PITCH_X_M - FROM_X_M + PAD + OVERSHOOT;
const VIEW_H = PITCH_Y_M + PAD * 2;

/**
 * Capped at about 1.6 m. An earlier version reached 3.7 m — a 0.40 chance drew a
 * circle wider than the six-yard box is deep, and a busy penalty area became one
 * shape. Square root, because area is what the eye compares.
 */
function radius(xg: number): number {
  return 0.55 + Math.sqrt(Math.max(xg, 0)) * 1.7;
}

type Style = {
  /** How the line reads: a goal should be unmissable, a wild miss shouldn't. */
  width: number;
  opacity: number;
  dash?: string;
  /** Solid dot at the origin? Only for shots that were on target. */
  solid: boolean;
};

const STYLE: Record<string, Style> = {
  goal: { width: 0.55, opacity: 1, solid: true },
  saved: { width: 0.4, opacity: 0.62, solid: true },
  blocked: { width: 0.4, opacity: 0.45, dash: "1.2 1", solid: false },
  off_target: { width: 0.32, opacity: 0.34, dash: "2 1.6", solid: false },
};

function ShotMark({ shot, colour }: { shot: Shot; colour: string }) {
  const style = STYLE[shot.outcome] ?? STYLE.off_target;
  const cx = toX(shot.x);
  const cy = toY(shot.y);
  const r = radius(shot.xg);

  const over = shot.endZ !== null && shot.endZ > CROSSBAR_M;
  const hasLine = shot.endX !== null && shot.endY !== null;

  // A shot over the bar crosses the goal line inside the posts when seen from
  // above, so drawing it to x = 100 would look like a goal. Carrying it past the
  // line is the top-down way to show height — and it is reading `end_z`, not
  // guessing.
  const ex = hasLine ? (over ? PITCH_X_M + 2.4 : toX(shot.endX!)) : 0;
  const ey = hasLine ? toY(shot.endY!) : 0;

  const label =
    `${shot.minute}′ #${shot.shirt} — ${shot.outcome.replace("_", " ")}` +
    `${over ? " (over the bar)" : ""}, ${shot.xg.toFixed(2)} xG`;

  return (
    <g>
      <title>{label}</title>

      {hasLine && (
        <line
          x1={cx}
          y1={cy}
          x2={ex}
          y2={ey}
          stroke={colour}
          strokeWidth={style.width}
          strokeOpacity={style.opacity}
          strokeDasharray={style.dash}
          strokeLinecap="round"
        />
      )}

      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={style.solid ? colour : "var(--color-midnight)"}
        fillOpacity={style.solid ? 0.95 : 0.9}
        stroke={colour}
        strokeWidth={0.35}
        strokeOpacity={style.solid ? 1 : 0.75}
      />

      {/* A goal gets a ring at the origin so it is findable at a glance — a
          low-xG goal draws a small dot, and it is still the best moment of the
          match. */}
      {shot.outcome === "goal" && (
        <circle
          cx={cx}
          cy={cy}
          r={r + 1.4}
          fill="none"
          stroke={colour}
          strokeWidth={0.35}
          strokeOpacity={0.7}
        />
      )}
    </g>
  );
}

export function ShotMap({
  shots,
  homeName,
  awayName,
}: {
  shots: Shot[];
  homeName: string;
  awayName: string;
}) {
  const [side, setSide] = useState<Side>("home");

  const shown = shots.filter((s) => s.side === side);
  const colour = side === "home" ? "var(--color-lime)" : "var(--color-floodlight)";
  const line = "var(--color-steel)";

  // Matches played before placement was recorded have no trajectories, and
  // cannot get them retroactively — saying so beats letting the map look broken.
  const anyPlacement = shots.some((s) => s.endX !== null);

  const goals = shown.filter((s) => s.outcome === "goal").length;
  const saved = shown.filter((s) => s.outcome === "saved").length;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex border border-steel/40"
        role="tablist"
        aria-label="Shot map team"
      >
        {(["home", "away"] as Side[]).map((value) => {
          const active = value === side;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSide(value)}
              className={`flex flex-1 items-center justify-center gap-2 px-4 py-2 font-sans text-xs font-semibold transition-colors duration-instant ${
                active ? "bg-lime/10 text-lime" : "text-mute hover:text-floodlight"
              } ${value === "away" ? "border-l border-steel/40" : ""}`}
            >
              {/* Which colour this side's shots are drawn in. The active state
                  stays lime per the design system, so without this the away tab
                  would read lime while its marks are white. */}
              <span
                aria-hidden
                className={`size-2 shrink-0 ${value === "home" ? "bg-lime" : "bg-floodlight"}`}
              />
              <span className="truncate">{value === "home" ? homeName : awayName}</span>
            </button>
          );
        })}
      </div>

      <svg
        viewBox={`${VIEW_X} ${-PAD} ${VIEW_W} ${VIEW_H}`}
        className="w-full"
        role="img"
        aria-label={`Shot map for ${side === "home" ? homeName : awayName}: ${shown.length} shots, ${goals} goals, ${saved} saved.`}
      >
        {/* Every measurement is the real one, in metres. */}
        <g stroke={line} strokeWidth={0.3} fill="none" opacity={0.5}>
          <rect
            x={FROM_X_M}
            y={0}
            width={PITCH_X_M - FROM_X_M}
            height={PITCH_Y_M}
          />
          {/* Penalty area: 16.5 m deep, 40.32 m wide */}
          <rect x={PITCH_X_M - 16.5} y={(PITCH_Y_M - 40.32) / 2} width={16.5} height={40.32} />
          {/* Six-yard box: 5.5 m deep, 18.32 m wide */}
          <rect x={PITCH_X_M - 5.5} y={(PITCH_Y_M - 18.32) / 2} width={5.5} height={18.32} />
          <circle cx={PITCH_X_M / 2} cy={PITCH_Y_M / 2} r={9.15} />
          <circle cx={PITCH_X_M - 11} cy={PITCH_Y_M / 2} r={0.45} fill={line} stroke="none" />
          <path
            d={`M ${PITCH_X_M - 16.5} ${PITCH_Y_M / 2 - 7.3} A 9.15 9.15 0 0 0 ${PITCH_X_M - 16.5} ${PITCH_Y_M / 2 + 7.3}`}
          />
        </g>

        {/* The goal mouth, drawn heaviest — it is what every line points at. */}
        <line
          x1={PITCH_X_M}
          y1={PITCH_Y_M / 2 - 3.66}
          x2={PITCH_X_M}
          y2={PITCH_Y_M / 2 + 3.66}
          stroke="var(--color-floodlight)"
          strokeWidth={0.85}
          strokeOpacity={0.9}
        />

        {/* Goals last, so a goal is never buried under a wayward effort. */}
        {shown
          .filter((s) => s.outcome !== "goal")
          .map((s) => (
            <ShotMark key={s.seq} shot={s} colour={colour} />
          ))}
        {shown
          .filter((s) => s.outcome === "goal")
          .map((s) => (
            <ShotMark key={s.seq} shot={s} colour={colour} />
          ))}
      </svg>

      <Legend anyPlacement={anyPlacement} shots={shown.length} />
    </div>
  );
}

function Legend({ anyPlacement, shots }: { anyPlacement: boolean; shots: number }) {
  const keys = [
    { key: "goal", text: "Goal" },
    { key: "saved", text: "Saved" },
    { key: "blocked", text: "Blocked" },
    { key: "off_target", text: "Off target" },
  ];

  return (
    <div className="flex flex-col gap-2 border-t border-steel/25 pt-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {keys.map(({ key, text }) => {
          const style = STYLE[key];
          return (
            <span key={key} className="flex items-center gap-1.5">
              <svg width="26" height="10" viewBox="0 0 26 10" aria-hidden className="text-mute">
                <line
                  x1={5}
                  y1={5}
                  // Blocked stops short in the key too, because that is the
                  // whole difference between it and a save.
                  x2={key === "blocked" ? 14 : 25}
                  y2={5}
                  stroke="currentColor"
                  strokeWidth={1.2}
                  strokeOpacity={style.opacity}
                  strokeDasharray={style.dash ? "3 2" : undefined}
                />
                <circle
                  cx={5}
                  cy={5}
                  r={2.6}
                  fill={style.solid ? "currentColor" : "var(--color-surface)"}
                  stroke="currentColor"
                  strokeWidth={1}
                />
              </svg>
              <span className="font-sans text-xs text-mute">{text}</span>
            </span>
          );
        })}
        <span className="ml-auto font-sans text-xs text-mute">Dot size = xG</span>
      </div>

      {shots > 0 && !anyPlacement && (
        <p className="font-sans text-xs leading-relaxed text-floodlight/40">
          Trajectories weren&rsquo;t recorded for this match — where each shot
          ended wasn&rsquo;t observed at the time, so it can&rsquo;t be filled in
          now. Matches played from here on will show them.
        </p>
      )}
    </div>
  );
}
