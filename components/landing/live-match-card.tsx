"use client";

import { Panel } from "@/components/ui/panel";
import { LiveBadge } from "@/components/ui/live-badge";
import { ClubMark } from "./club-mark";
import { useDemoClock } from "@/lib/demo/clock";
import { matchStateAt, HOME, AWAY, TRACKED_PLAYER } from "@/lib/demo/timeline";

/**
 * The hero's set piece. Reads the same scripted event stream as the match
 * center, so the two can never disagree about the clock or the score.
 *
 * Fictional data, deliberately not wired to a live match — the landing page has
 * to work when nothing is in progress.
 */
export function LiveMatchCard() {
  const { t, ref } = useDemoClock<HTMLDivElement>();
  const state = matchStateAt(t);
  const rising = state.priceDelta >= 0;

  return (
    <div ref={ref}>
      <Panel live brackets bodyClassName="p-6 sm:p-7">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <LiveBadge />
            <span className="numeric text-sm text-floodlight/70">
              {state.clock}
            </span>
          </div>

          {/* Scoreline */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
              <ClubMark variant="home" className="h-8 w-8" />
              <span className="truncate font-sans text-xs font-medium text-floodlight">
                {HOME.name}
              </span>
            </div>

            <div className="numeric shrink-0 text-5xl leading-none font-medium text-floodlight">
              {state.homeScore}
              <span className="px-1 text-mute">:</span>
              {state.awayScore}
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-end gap-2">
              <ClubMark variant="away" className="h-8 w-8" />
              <span className="truncate font-sans text-xs font-medium text-floodlight">
                {AWAY.name}
              </span>
            </div>
          </div>

          {/* Possession */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="numeric text-xs text-lime">
                {state.possession}%
              </span>
              <span className="label text-mute">Possession</span>
              <span className="numeric text-xs text-floodlight/50">
                {100 - state.possession}%
              </span>
            </div>
            <div className="flex h-1 gap-px" aria-hidden="true">
              <span
                className="bg-lime transition-[width] duration-700 ease-out"
                style={{ width: `${state.possession}%` }}
              />
              <span className="flex-1 bg-steel/50" />
            </div>
          </div>

          {/* Event feed — newest first */}
          <div
            className="flex min-h-[4.5rem] flex-col gap-2 border-t border-steel/25 pt-4"
            aria-live="polite"
          >
            {state.feed.slice(0, 3).map((event, i) => (
              <div
                key={`${event.minute}-${event.detail}`}
                className="flex items-center gap-3"
                style={{ opacity: 1 - i * 0.38 }}
              >
                <span className="numeric w-8 shrink-0 text-xs text-mute">
                  {event.minute}
                </span>
                <span
                  className={`truncate font-sans text-xs ${
                    event.type === "Goal"
                      ? "text-lime"
                      : event.type === "Card"
                        ? "text-live"
                        : "text-floodlight/65"
                  }`}
                >
                  {event.detail}
                </span>
              </div>
            ))}
          </div>

          {/* The market side of the same moment */}
          <div className="flex items-center justify-between border-t border-steel/25 pt-4">
            <div className="flex flex-col gap-1">
              <span className="label text-mute">Bourse · {TRACKED_PLAYER}</span>
              <span className="numeric text-lg leading-none text-floodlight">
                £{state.price.toFixed(2)}
              </span>
            </div>
            {/* Sign and arrow glyph alongside the color, never color alone. */}
            <span
              className={`numeric text-sm ${rising ? "text-lime" : "text-live"}`}
            >
              {rising ? "▲" : "▼"} {rising ? "+" : "−"}
              {Math.abs(state.priceDelta).toFixed(2)}
            </span>
          </div>
        </div>
      </Panel>
    </div>
  );
}
