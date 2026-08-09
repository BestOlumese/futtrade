"use client";

import { useState } from "react";
import type { Shot, Side } from "@/lib/match/derive";

/**
 * The shot map — one team at a time, with the trajectory of every shot.
 *
 * ── Drawn in the landing page's visual language ─────────────────────────────
 *
 * `components/landing/pitch.tsx` establishes how a pitch looks in this product,
 * and this follows it exactly: every line is `vectorEffect="non-scaling-stroke"`
 * at 1px, so the markings stay hairline whatever size the map is rendered at.
 *
 * That is the whole reason an earlier version looked heavy. Stroke widths were
 * given in METRES — `strokeWidth={0.3}` on a 105m pitch drawn 460px wide is two
 * and a half device pixels, and every line and every dot edge came out thick and
 * blunt. A non-scaling stroke is the fix, not a smaller number.
 *
 * Dots follow the same source: a solid fill and NO stroke for one side, a
 * 1.5px hairline outline over a `midnight` fill for the other. No rings, no
 * punched-out centres, nothing drawn around a mark to decorate it.
 *
 * ── What the marks mean ─────────────────────────────────────────────────────
 *
 *   line     what became of the shot, and where it ended
 *   radius   xG — a big dot is a big chance
 *   colour   team, and only team
 *
 * Colour is never the only signal: the line style and where it stops carry the
 * outcome, so the map reads without separating lime from white.
 *
 * The trajectory comes from `end_x`/`end_y`/`end_z` on the event, never invented
 * here — see docs/features/03-event-stream.md § Shot placement.
 */

const PITCH_X_M = 105;
const PITCH_Y_M = 68;
/** Events are on a 0–100 scale for both axes, but a pitch is 105 m by 68 m. */
const toX = (x: number) => (x * PITCH_X_M) / 100;
const toY = (y: number) => (y * PITCH_Y_M) / 100;

/** Real dimensions, so the box has the shape it has on a real pitch. */
const PENALTY_DEPTH = 16.5;
const PENALTY_HALF = 40.32 / 2;
const SIX_DEPTH = 5.5;
const SIX_HALF = 18.32 / 2;
const SPOT_DEPTH = 11;
const ARC_R = 9.15;
const GOAL_HALF = 3.66;
const CROSSBAR_M = 2.44;
const CORNER_R = 1;

/** The attacking half plus a little of the middle third, so halfway shows. */
const FROM_X_M = toX(46);
const HALFWAY = PITCH_X_M / 2;

/**
 * Padding rather than `overflow: visible`.
 *
 * The goal-line stroke is centred on the pitch edge, so half falls outside, and
 * a shot over the bar is carried past the line to show height. Letting either
 * escape the element means it paints over the layout; padding keeps the whole
 * picture inside its own box.
 */
const PAD = 1.4;
const OVERSHOOT = 3.4;
const VIEW_X = FROM_X_M - PAD;
const VIEW_W = PITCH_X_M - FROM_X_M + PAD + OVERSHOOT;
const VIEW_H = PITCH_Y_M + PAD * 2;

/** A 0.02 chance and a 0.18 one must differ; area is what the eye compares. */
function radius(xg: number): number {
  return 0.62 + Math.sqrt(Math.max(xg, 0)) * 1.75;
}

/**
 * Two line weights, not four. On target speaks; everything else recedes.
 *
 * `blocked` and `off_target` share a weight and are told apart by where the line
 * STOPS — one ends in a defender, the other runs past the post. That is a more
 * honest signal than a third dash pattern.
 *
 * Widths are in DEVICE PIXELS, because every stroke here is non-scaling.
 */
type Style = {
  width: number;
  opacity: number;
  dash?: string;
  /** Solid fill and no outline, or a hairline outline over midnight. */
  filled: boolean;
  /** How strongly the dot itself is filled. A goal is the loudest mark. */
  fill: number;
};

const STYLE: Record<string, Style> = {
  goal: { width: 1.6, opacity: 0.95, filled: true, fill: 1 },
  // 0.62 turned floodlight into a muddy grey that read as disabled rather than
  // as a save. A solid mark should look solid; the line carries the difference.
  saved: { width: 1.2, opacity: 0.55, filled: true, fill: 0.85 },
  blocked: { width: 1, opacity: 0.3, dash: "2 2", filled: false, fill: 1 },
  off_target: { width: 1, opacity: 0.3, dash: "4 3", filled: false, fill: 1 },
};

const styleFor = (outcome: string) => STYLE[outcome] ?? STYLE.off_target;

/** Where the ball ended. Null on matches recorded before placement existed. */
function endPoint(shot: Shot): { ex: number; ey: number } | null {
  if (shot.endX === null || shot.endY === null) return null;
  const over = shot.endZ !== null && shot.endZ > CROSSBAR_M;
  // Seen from above, a shot over the bar crosses the goal line inside the posts,
  // so stopping it at the line would look like a goal. Carrying it past is the
  // top-down way to show height — reading `end_z`, not guessing.
  return {
    ex: over ? PITCH_X_M + 2.6 : toX(shot.endX),
    ey: toY(shot.endY),
  };
}

function shotLabel(shot: Shot): string {
  const over = shot.endZ !== null && shot.endZ > CROSSBAR_M;
  return (
    `${shot.minute}′ #${shot.shirt} — ${shot.outcome.replace("_", " ")}` +
    `${over ? " (over the bar)" : ""}, ${shot.xg.toFixed(2)} xG`
  );
}

function ShotLine({ shot, colour }: { shot: Shot; colour: string }) {
  const end = endPoint(shot);
  if (!end) return null;
  const style = styleFor(shot.outcome);
  return (
    <line
      x1={toX(shot.x)}
      y1={toY(shot.y)}
      x2={end.ex}
      y2={end.ey}
      stroke={colour}
      strokeWidth={style.width}
      strokeOpacity={style.opacity}
      strokeDasharray={style.dash}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />
  );
}

function ShotDot({ shot, colour }: { shot: Shot; colour: string }) {
  const style = styleFor(shot.outcome);
  const cx = toX(shot.x);
  const cy = toY(shot.y);
  const r = radius(shot.xg);

  return (
    <g>
      <title>{shotLabel(shot)}</title>
      {/* A goal is the loudest mark on the map, and with no ring to mark it out
          the glow does that job — the same device the landing page gives the
          ball, and what the design system means by "lime at 12–20% in a blur,
          never a solid halo". */}
      {shot.outcome === "goal" && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={colour}
          fillOpacity={0.55}
          filter="url(#shotmap-glow)"
        />
      )}
      {/* A midnight disc under every mark. It keeps overlapping dots countable
          in a crowded penalty area, and it evens the palettes — lime reads
          heavier than floodlight at an identical radius. */}
      <circle cx={cx} cy={cy} r={r + 0.3} fill="var(--color-midnight)" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={style.filled ? colour : "var(--color-midnight)"}
        fillOpacity={style.filled ? style.fill : 1}
        // Solid marks carry no outline at all, exactly as on the landing pitch.
        stroke={style.filled ? "none" : colour}
        strokeWidth={style.filled ? 0 : 1.5}
        strokeOpacity={0.75}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

/**
 * Pitch furniture, in the landing page's hand: 1px non-scaling strokes at 0.4
 * opacity, with the goal line stronger because it is what every shot is measured
 * against.
 *
 * There is deliberately no line down the left-hand side. That edge is where the
 * view is cropped, not where the pitch ends, and drawing a boundary there would
 * invent a touchline that isn't on the grass.
 */
function PitchMarkings() {
  const line = "var(--color-steel)";
  const mid = PITCH_Y_M / 2;

  return (
    <g
      fill="none"
      stroke={line}
      strokeOpacity={0.4}
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
    >
      <defs>
        {/* A soft bloom for goals. Wide bounds, or the blur is clipped to the
            element's own box and the glow comes out square. */}
        <filter id="shotmap-glow" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
        {/* The D is the part of the 9.15m circle that falls outside the area. */}
        <clipPath id="shotmap-d" clipPathUnits="userSpaceOnUse">
          <rect x={0} y={0} width={PITCH_X_M - PENALTY_DEPTH} height={PITCH_Y_M} />
        </clipPath>
        <clipPath id="shotmap-corners" clipPathUnits="userSpaceOnUse">
          <rect x={0} y={0} width={PITCH_X_M} height={PITCH_Y_M} />
        </clipPath>
      </defs>

      {/* Touchlines only — the left edge is a crop, not a boundary. */}
      <path
        d={`M${FROM_X_M},0 L${PITCH_X_M},0 M${FROM_X_M},${PITCH_Y_M} L${PITCH_X_M},${PITCH_Y_M}`}
        vectorEffect="non-scaling-stroke"
      />

      {/* The goal line, stronger — every shot is measured against it. */}
      <path
        d={`M${PITCH_X_M},0 L${PITCH_X_M},${PITCH_Y_M}`}
        strokeOpacity={0.75}
        vectorEffect="non-scaling-stroke"
      />

      <path d={`M${HALFWAY},0 L${HALFWAY},${PITCH_Y_M}`} vectorEffect="non-scaling-stroke" />
      <circle cx={HALFWAY} cy={mid} r={ARC_R} vectorEffect="non-scaling-stroke" />

      <rect
        x={PITCH_X_M - PENALTY_DEPTH}
        y={mid - PENALTY_HALF}
        width={PENALTY_DEPTH}
        height={PENALTY_HALF * 2}
        vectorEffect="non-scaling-stroke"
      />
      <rect
        x={PITCH_X_M - SIX_DEPTH}
        y={mid - SIX_HALF}
        width={SIX_DEPTH}
        height={SIX_HALF * 2}
        vectorEffect="non-scaling-stroke"
      />

      <circle
        cx={PITCH_X_M - SPOT_DEPTH}
        cy={mid}
        r={0.4}
        fill={line}
        fillOpacity={0.5}
        stroke="none"
      />
      <circle
        cx={PITCH_X_M - SPOT_DEPTH}
        cy={mid}
        r={ARC_R}
        clipPath="url(#shotmap-d)"
        vectorEffect="non-scaling-stroke"
      />

      <g clipPath="url(#shotmap-corners)">
        <circle cx={PITCH_X_M} cy={0} r={CORNER_R} vectorEffect="non-scaling-stroke" />
        <circle cx={PITCH_X_M} cy={PITCH_Y_M} r={CORNER_R} vectorEffect="non-scaling-stroke" />
      </g>
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

  // Matches played before placement was recorded have no trajectories and cannot
  // get them retroactively — saying so beats letting the map look broken.
  const anyPlacement = shots.some((s) => s.endX !== null);
  const goals = shown.filter((s) => s.outcome === "goal").length;
  const saved = shown.filter((s) => s.outcome === "saved").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex border border-steel/40" role="tablist" aria-label="Shot map team">
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
              {/* Which colour this side's shots are drawn in. The active state is
                  lime per the design system, so without this the away tab would
                  read lime while its marks are white. */}
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
        <PitchMarkings />

        {/* The goal mouth, the one mark drawn in floodlight — it is what every
            line points at. */}
        <line
          x1={PITCH_X_M}
          y1={PITCH_Y_M / 2 - GOAL_HALF}
          x2={PITCH_X_M}
          y2={PITCH_Y_M / 2 + GOAL_HALF}
          stroke="var(--color-floodlight)"
          strokeWidth={2}
          strokeOpacity={0.85}
          vectorEffect="non-scaling-stroke"
        />

        {/* Every line beneath every dot. Drawn per-shot, a later shot's line
            crosses an earlier shot's dot, which is most of what makes this kind
            of plot look tangled. */}
        <g>
          {shown.map((shot) => (
            <ShotLine key={shot.seq} shot={shot} colour={colour} />
          ))}
        </g>

        <g>
          {shown
            .filter((s) => s.outcome !== "goal")
            .map((shot) => (
              <ShotDot key={shot.seq} shot={shot} colour={colour} />
            ))}
          {/* Goals last, so one is never buried under a wayward effort. */}
          {shown
            .filter((s) => s.outcome === "goal")
            .map((shot) => (
              <ShotDot key={shot.seq} shot={shot} colour={colour} />
            ))}
        </g>
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
          const style = styleFor(key);
          return (
            <span key={key} className="flex items-center gap-1.5">
              <svg width="30" height="12" viewBox="0 0 30 12" aria-hidden className="text-mute">
                <line
                  x1={6}
                  y1={6}
                  // Blocked stops short in the key too, because where the line
                  // ends is the whole difference between it and a wayward one.
                  x2={key === "blocked" ? 15 : 29}
                  y2={6}
                  stroke="currentColor"
                  strokeWidth={style.filled ? 1.5 : 1}
                  // Lifted from the map's opacity: a weight meant to recede on a
                  // 500px pitch vanishes entirely at key size.
                  strokeOpacity={Math.max(style.opacity, 0.7)}
                  strokeDasharray={style.dash ? "2.5 2" : undefined}
                />
                <circle cx={6} cy={6} r={4} fill="var(--color-surface)" />
                <circle
                  cx={6}
                  cy={6}
                  r={3.2}
                  fill={style.filled ? "currentColor" : "var(--color-surface)"}
                  fillOpacity={style.filled ? style.fill : 1}
                  stroke={style.filled ? "none" : "currentColor"}
                  strokeWidth={1.2}
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
