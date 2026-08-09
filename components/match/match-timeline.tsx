import type { ReactNode } from "react";
import type { Moment, Side } from "@/lib/match/derive";

/**
 * Goals and cards, in order.
 *
 * Deliberately not a full ticker — that belongs to the live view. A post-match
 * timeline listing three hundred passes is a log file, not a summary.
 *
 * A second booking appears as two entries, a yellow then a red, because that is
 * what the referee did and what the event log records.
 */
export function MatchTimeline({
  moments,
  homeName,
  awayName,
}: {
  moments: Moment[];
  homeName: string;
  awayName: string;
}) {
  if (moments.length === 0) {
    return (
      <p className="font-sans text-sm leading-relaxed text-floodlight/45">
        No goals and no cards. It happens.
      </p>
    );
  }

  return (
    <ol className="flex flex-col">
      {moments.map((m) => (
        <li
          key={m.seq}
          className="grid grid-cols-[3rem_1.25rem_1fr] items-baseline gap-3 border-b border-steel/20 py-2 last:border-b-0"
        >
          <span className="numeric text-xs text-mute">{m.minute}′</span>
          <Glyph kind={m.kind} side={m.side} />
          <span className="font-sans text-sm text-floodlight">
            <Shirt side={m.side}>#{m.shirt}</Shirt>{" "}
            <span className="text-mute">
              {m.kind === "goal"
                ? m.assist
                  ? `scored — assist #${m.assist}`
                  : "scored"
                : m.kind === "red"
                  ? "sent off"
                  : "booked"}
              {" · "}
              {m.side === "home" ? homeName : awayName}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The team colour, used consistently with the shot map and the stat card. */
function Shirt({ side, children }: { side: Side; children: ReactNode }) {
  return (
    <span className={`numeric ${side === "home" ? "text-lime" : "text-floodlight"}`}>
      {children}
    </span>
  );
}

function Glyph({ kind, side }: { kind: Moment["kind"]; side: Side }) {
  if (kind === "goal") {
    // An SVG data mark, matching the shot map's dots — NOT a `rounded-full`
    // div. The design system permits no border-radius outside the live dot, and
    // a plotted point is a shape rather than a rounded box.
    return (
      <svg width="12" height="12" viewBox="-6 -6 12 12" role="img" aria-label="Goal">
        <circle
          r={4}
          className={side === "home" ? "fill-lime" : "fill-floodlight"}
        />
      </svg>
    );
  }
  return (
    <span
      className={`h-3.5 w-[10px] ${kind === "red" ? "bg-live" : "bg-card-yellow"}`}
      aria-label={kind === "red" ? "Red card" : "Yellow card"}
      role="img"
    />
  );
}
