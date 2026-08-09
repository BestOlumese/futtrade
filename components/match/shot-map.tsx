import type { Shot } from "@/lib/match/derive";

/**
 * The shot map — one half-pitch, both teams attacking the same goal.
 *
 * That overlay is only possible because of the event stream's coordinate
 * convention: `x` is always measured toward the goal the ACTING side is
 * attacking, so every shot in the log already points the same way and no
 * flipping is needed here. See docs/features/03-event-stream.md.
 *
 * SVG rather than canvas. A few dozen dots stay crisp at any size, they can be
 * titled for a screen reader, and they take the same design tokens as the rest
 * of the page. Phaser is for the moving pitch in Phase 06.
 *
 * Encoding, per docs/08-live-match-viewer.md:
 *   radius  xG        — a big dot is a big chance, which is the map's point
 *   fill    outcome   — goal solid with a ring, saved solid, miss hollow
 *   colour  team      — and only team
 *
 * Colour is deliberately not the only signal for outcome: fill carries it, so
 * the map still reads for someone who cannot separate lime from white.
 */

/**
 * The map is drawn in METRES, not in the event stream's 0–100 units.
 *
 * Events store x and y both on 0–100, but a pitch is 105 m by 68 m — so one
 * x-unit is 1.05 m and one y-unit is 0.68 m. SVG scales both axes equally, so
 * plotting the raw units stretches the pitch by half again vertically: the
 * penalty area comes out tall and narrow and the whole thing reads as portrait.
 * Converting on the way in is the only way the box has the right shape.
 */
const PITCH_X_M = 105;
const PITCH_Y_M = 68;
const toX = (x: number) => (x * PITCH_X_M) / 100;
const toY = (y: number) => (y * PITCH_Y_M) / 100;

/** The map shows the attacking half plus a little of the middle third. */
const FROM_X_M = toX(48);
const VIEW_W = PITCH_X_M - FROM_X_M;

/**
 * A 0.02 chance and a 0.45 chance must be visibly different, but a 0.45 must not
 * swallow the six-yard box. Square root, because area is what the eye compares.
 */
function radius(xg: number): number {
  return 0.9 + Math.sqrt(Math.max(xg, 0)) * 4.4;
}

function ShotDot({ shot, colour }: { shot: Shot; colour: string }) {
  const r = radius(shot.xg);
  const cx = toX(shot.x);
  const cy = toY(shot.y);
  const solid = shot.outcome === "goal" || shot.outcome === "saved";
  const label =
    `${shot.minute}′ #${shot.shirt} — ${shot.outcome.replace("_", " ")}, ` +
    `${shot.xg.toFixed(2)} xG`;

  return (
    <g>
      <title>{label}</title>
      {shot.outcome === "goal" && (
        // The ring is what makes a goal findable at a glance without relying on
        // size alone — a low-xG goal is small, and it is still the best moment
        // of the match.
        <circle
          cx={cx}
          cy={cy}
          r={r + 1.9}
          fill="none"
          stroke={colour}
          strokeWidth={0.6}
          opacity={0.75}
        />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={solid ? colour : "none"}
        fillOpacity={shot.outcome === "goal" ? 0.85 : 0.42}
        stroke={colour}
        strokeWidth={0.55}
        strokeOpacity={0.95}
        strokeDasharray={shot.outcome === "blocked" ? "1.4 1.1" : undefined}
      />
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
  const line = "var(--color-steel)";
  const home = shots.filter((s) => s.side === "home");
  const away = shots.filter((s) => s.side === "away");

  return (
    <div className="flex flex-col gap-4">
      <svg
        viewBox={`${FROM_X_M} 0 ${VIEW_W} ${PITCH_Y_M}`}
        className="w-full"
        // The boundary stroke sits on the viewBox edge, so half of it is
        // outside. Without this the pitch has three sides.
        style={{ overflow: "visible" }}
        role="img"
        aria-label={`Shot map. ${homeName} ${home.length} shots, ${awayName} ${away.length} shots.`}
      >
        {/* Every measurement below is the real one, in metres. */}
        <g stroke={line} strokeWidth={0.3} fill="none" opacity={0.55}>
          {/* Touchlines and the cut edge */}
          <rect x={FROM_X_M} y={0} width={VIEW_W} height={PITCH_Y_M} />
          {/* Penalty area: 16.5m deep, 40.32m wide */}
          <rect x={PITCH_X_M - 16.5} y={(PITCH_Y_M - 40.32) / 2} width={16.5} height={40.32} />
          {/* Six-yard box: 5.5m deep, 18.32m wide */}
          <rect x={PITCH_X_M - 5.5} y={(PITCH_Y_M - 18.32) / 2} width={5.5} height={18.32} />
          {/* Centre circle, clipped by the edge of the view */}
          <circle cx={PITCH_X_M / 2} cy={PITCH_Y_M / 2} r={9.15} />
          {/* Penalty spot, 11m out */}
          <circle cx={PITCH_X_M - 11} cy={PITCH_Y_M / 2} r={0.45} fill={line} stroke="none" />
          {/* The D — the arc of the centre circle radius outside the box */}
          <path
            d={`M ${PITCH_X_M - 16.5} ${PITCH_Y_M / 2 - 7.3} A 9.15 9.15 0 0 0 ${PITCH_X_M - 16.5} ${PITCH_Y_M / 2 + 7.3}`}
          />
        </g>
        {/* The goal itself, drawn heavier so the target of every dot is obvious */}
        <line
          x1={PITCH_X_M}
          y1={PITCH_Y_M / 2 - 3.66}
          x2={PITCH_X_M}
          y2={PITCH_Y_M / 2 + 3.66}
          stroke="var(--color-floodlight)"
          strokeWidth={0.8}
          opacity={0.85}
        />

        {/* Away first, so home sits on top — the reader's own side usually is */}
        {away.map((s) => (
          <ShotDot key={s.seq} shot={s} colour="var(--color-floodlight)" />
        ))}
        {home.map((s) => (
          <ShotDot key={s.seq} shot={s} colour="var(--color-lime)" />
        ))}
      </svg>

      <ShotMapLegend homeName={homeName} awayName={awayName} />
    </div>
  );
}

function ShotMapLegend({
  homeName,
  awayName,
}: {
  homeName: string;
  awayName: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-steel/25 pt-3">
      <span className="flex items-center gap-2">
        <span className="size-2.5 bg-lime" aria-hidden />
        <span className="font-sans text-xs text-floodlight">{homeName}</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="size-2.5 bg-floodlight" aria-hidden />
        <span className="font-sans text-xs text-floodlight">{awayName}</span>
      </span>

      <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
        {[
          { key: "goal", text: "Goal" },
          { key: "saved", text: "On target" },
          { key: "off_target", text: "Off target" },
          { key: "blocked", text: "Blocked" },
        ].map(({ key, text }) => (
          <span key={key} className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden>
              {key === "goal" && (
                <circle r={5.4} fill="none" stroke="currentColor" strokeWidth={0.9} className="text-mute" />
              )}
              <circle
                r={3.4}
                className="text-mute"
                fill={key === "goal" || key === "saved" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray={key === "blocked" ? "2 1.5" : undefined}
              />
            </svg>
            <span className="font-sans text-xs text-mute">{text}</span>
          </span>
        ))}
        <span className="font-sans text-xs text-mute">Size = xG</span>
      </span>
    </div>
  );
}
