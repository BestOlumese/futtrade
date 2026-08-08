import { PITCH, GOAL } from "@/lib/demo/timeline";

/**
 * Pitch furniture, drawn to scale from the same geometry the ball is aimed at.
 *
 * Everything lives in playing-area coordinates (0–100 in both axes), which is
 * also the coordinate space of every player and the ball. Because x spans 105m
 * and y spans 68m, the two axes have different metre scales — so a circle on the
 * grass is an ellipse here, and the arc radii differ accordingly.
 *
 * Drawn in SVG rather than as a stack of divs because arcs and the penalty D
 * need real paths, and `vectorEffect` keeps stroke weight even under the
 * non-uniform scale.
 */

/** The net margin, as a percentage of the whole viewer box. */
export const NET_MARGIN_PCT =
  (PITCH.netDepthM / (PITCH.lengthM + 2 * PITCH.netDepthM)) * 100;

/** Viewer aspect: playing area plus a net's depth at each end. */
export const VIEWER_ASPECT = `${PITCH.lengthM + 2 * PITCH.netDepthM} / ${PITCH.widthM}`;

export function PitchMarkings() {
  const paDepth = PITCH.penaltyAreaDepth;
  const paTop = 50 - PITCH.penaltyAreaHalfWidth;
  const paHeight = PITCH.penaltyAreaHalfWidth * 2;

  const sixDepth = PITCH.sixYardDepth;
  const sixTop = 50 - PITCH.sixYardHalfWidth;
  const sixHeight = PITCH.sixYardHalfWidth * 2;

  const spot = PITCH.penaltySpotDepth;
  const line = "var(--color-steel)";

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
      fill="none"
      stroke={line}
      strokeOpacity="0.4"
      strokeWidth="1"
      vectorEffect="non-scaling-stroke"
      // The boundary stroke is centred on the viewBox edge, so half of it falls
      // outside. With the default `overflow: hidden` that half is clipped and
      // the touchlines and goal lines all but disappear.
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* The penalty D is the part of the 9.15m circle outside the area. */}
        <clipPath id="arc-left" clipPathUnits="userSpaceOnUse">
          <rect x={paDepth} y="0" width={100 - paDepth} height="100" />
        </clipPath>
        <clipPath id="arc-right" clipPathUnits="userSpaceOnUse">
          <rect x="0" y="0" width={100 - paDepth} height="100" />
        </clipPath>
        <clipPath id="inside-pitch" clipPathUnits="userSpaceOnUse">
          <rect x="0" y="0" width="100" height="100" />
        </clipPath>
      </defs>

      {/* Touchlines */}
      <rect x="0" y="0" width="100" height="100" vectorEffect="non-scaling-stroke" />

      {/* Goal lines, drawn stronger — they're the reference every shot,
          penalty spot and box depth is measured from. */}
      <path
        d="M0,0 L0,100 M100,0 L100,100"
        strokeOpacity="0.75"
        vectorEffect="non-scaling-stroke"
      />

      {/* Halfway line and centre circle */}
      <path d="M50,0 L50,100" vectorEffect="non-scaling-stroke" />
      <ellipse
        cx="50" cy="50" rx={PITCH.arcRx} ry={PITCH.arcRy}
        vectorEffect="non-scaling-stroke"
      />
      <ellipse cx="50" cy="50" rx="0.5" ry="0.8" fill={line} fillOpacity="0.5" stroke="none" />

      {/* Penalty areas */}
      <rect x="0" y={paTop} width={paDepth} height={paHeight} vectorEffect="non-scaling-stroke" />
      <rect
        x={100 - paDepth} y={paTop} width={paDepth} height={paHeight}
        vectorEffect="non-scaling-stroke"
      />

      {/* Six-yard boxes */}
      <rect x="0" y={sixTop} width={sixDepth} height={sixHeight} vectorEffect="non-scaling-stroke" />
      <rect
        x={100 - sixDepth} y={sixTop} width={sixDepth} height={sixHeight}
        vectorEffect="non-scaling-stroke"
      />

      {/* Penalty spots */}
      <ellipse cx={spot} cy="50" rx="0.5" ry="0.8" fill={line} fillOpacity="0.5" stroke="none" />
      <ellipse
        cx={100 - spot} cy="50" rx="0.5" ry="0.8"
        fill={line} fillOpacity="0.5" stroke="none"
      />

      {/* Penalty arcs, clipped so only the D outside each area shows */}
      <ellipse
        cx={spot} cy="50" rx={PITCH.arcRx} ry={PITCH.arcRy}
        clipPath="url(#arc-left)" vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx={100 - spot} cy="50" rx={PITCH.arcRx} ry={PITCH.arcRy}
        clipPath="url(#arc-right)" vectorEffect="non-scaling-stroke"
      />

      {/* Corner arcs — full ellipses on the corners, clipped to the pitch */}
      <g clipPath="url(#inside-pitch)">
        {[
          [0, 0], [100, 0], [0, 100], [100, 100],
        ].map(([cx, cy]) => (
          <ellipse
            key={`${cx}-${cy}`}
            cx={cx} cy={cy} rx={PITCH.cornerRx} ry={PITCH.cornerRy}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    </svg>
  );
}

/**
 * A goal, seen from above: the net sits OUTSIDE the playing area, behind the
 * goal line, as on a real diagram. Positioned in playing-area coordinates, so
 * it lines up exactly with the targets shots are aimed at.
 */
export function GoalNet({ end, flash }: { end: "left" | "right"; flash: boolean }) {
  const depth = PITCH.netDepth;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{
        left: end === "right" ? "100%" : `${-depth}%`,
        width: `${depth}%`,
        top: `${GOAL.yTop}%`,
        height: `${GOAL.yBottom - GOAL.yTop}%`,
      }}
    >
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: flash ? 0.7 : 0.2,
          backgroundImage:
            "repeating-linear-gradient(45deg, var(--color-floodlight) 0 1px, transparent 1px 4px)",
        }}
      />
      {/* Back of the net */}
      <div
        className="absolute inset-y-0 w-px bg-floodlight/50"
        style={end === "right" ? { right: 0 } : { left: 0 }}
      />
      {/* The posts, on the goal line itself */}
      <div
        className={`absolute h-0.75 w-full transition-colors duration-300 ${
          flash ? "bg-lime" : "bg-floodlight/85"
        }`}
        style={{ top: 0 }}
      />
      <div
        className={`absolute h-0.75 w-full transition-colors duration-300 ${
          flash ? "bg-lime" : "bg-floodlight/85"
        }`}
        style={{ bottom: 0 }}
      />
    </div>
  );
}
