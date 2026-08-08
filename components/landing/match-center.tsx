"use client";

import { Panel } from "@/components/ui/panel";
import { LiveBadge } from "@/components/ui/live-badge";
import { SectionHeading } from "./section-heading";
import { useDemoClock } from "@/lib/demo/clock";
import { matchStateAt } from "@/lib/demo/timeline";

/**
 * Section 2 — the strongest proof the product is real.
 *
 * A working surface shown inside a brand surface, so it takes working-surface
 * density: tight rows, small type, no cuts on individual rows. It is meant to
 * look busier than the rest of the page — that's the honest preview.
 *
 * The ball and players move via CSS transitions between low-frequency state
 * ticks. That's the same discipline the real viewer follows: interpolate
 * between confirmed ticks, never extrapolate ahead of them.
 */
export function MatchCenter() {
  const { t, ref } = useDemoClock<HTMLElement>();
  const state = matchStateAt(t);

  const stats = [
    { k: "Shots", v: String(state.shots) },
    { k: "xG", v: state.xg.toFixed(2) },
    { k: "Passes", v: String(state.passes) },
  ];

  return (
    <section
      ref={ref}
      id="match-center"
      className="flex scroll-mt-24 flex-col gap-10"
    >
      <SectionHeading
        label="Match center"
        title="Ninety minutes you can actually read"
        intro="One event stream drives all of it — the 2D viewer, the stats, player form, and every price on the market. Nothing here is reconstructed after the fact."
      />

      <Panel bodyClassName="p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <LiveBadge />
              <span className="numeric text-xs text-floodlight/70">
                {state.clock} · {state.homeScore}:{state.awayScore}
              </span>
            </div>

            {/* 2D viewer */}
            <div
              className="relative aspect-16/10 w-full border border-steel/30 bg-midnight"
              role="img"
              aria-label={`Two-dimensional match viewer. ${state.clock}, score ${state.homeScore} to ${state.awayScore}.`}
            >
              <div className="absolute inset-0" aria-hidden="true">
                <div className="absolute inset-y-0 left-1/2 w-px bg-steel/25" />
                <div className="absolute top-1/2 left-1/2 h-[22%] w-[14%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-steel/25" />
                <div className="absolute top-1/2 left-0 h-[42%] w-[14%] -translate-y-1/2 border-y border-r border-steel/25" />
                <div className="absolute top-1/2 right-0 h-[42%] w-[14%] -translate-y-1/2 border-y border-l border-steel/25" />
              </div>

              {/* Players are circles and a little larger than the ball, so the
                  ball reads as the ball and not as another player. */}
              {state.homePlayers.map((player, i) => (
                <span
                  key={`h${i}`}
                  aria-hidden="true"
                  className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime transition-all duration-150 ease-linear"
                  style={{ left: `${player.x}%`, top: `${player.y}%` }}
                />
              ))}
              {state.awayPlayers.map((player, i) => (
                <span
                  key={`a${i}`}
                  aria-hidden="true"
                  className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-floodlight/75 bg-midnight transition-all duration-150 ease-linear"
                  style={{ left: `${player.x}%`, top: `${player.y}%` }}
                />
              ))}

              {/* Ball. Sits on whoever holds it, then flies to the receiver —
                  so it always leaves a player and always arrives at one. The
                  flight is faster than the dwell, hence the shorter duration. */}
              <span
                aria-hidden="true"
                className={`absolute z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-live shadow-[0_0_9px_2px_var(--color-live)] ease-linear ${
                  state.ball.inFlight ? "duration-75" : "duration-150"
                } transition-all`}
                style={{ left: `${state.ball.x}%`, top: `${state.ball.y}%` }}
              />
            </div>

            {/* Momentum — a TIMELINE across the passage, not a scrolling
                window. Bars fill in as their slice is played; the rest of the
                passage stays empty rather than showing invented history. */}
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="label text-mute">Momentum</span>
                <span className="label text-mute">{state.momentumLeader}</span>
              </div>

              <div
                className="relative flex h-14 items-center gap-0.75"
                aria-hidden="true"
              >
                <span className="absolute inset-x-0 top-1/2 h-px bg-steel/30" />
                {state.momentum.map((bar, i) => {
                  const up = bar.value >= 0;
                  const height = Math.abs(bar.value) / 2;
                  return (
                    <div key={i} className="relative h-full flex-1">
                      {/* Unplayed slices read as an empty track. */}
                      {!bar.revealed && (
                        <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-steel/25" />
                      )}
                      {bar.revealed && (
                        <span
                          className={`absolute left-0 w-full transition-all duration-300 ease-out ${
                            up ? "bg-lime" : "bg-floodlight/35"
                          } ${bar.current ? "" : up ? "opacity-70" : "opacity-90"}`}
                          style={
                            up
                              ? { bottom: "50%", height: `${height}%` }
                              : { top: "50%", height: `${height}%` }
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between">
                <span className="numeric text-[10px] text-mute">64&apos;</span>
                <span className="numeric text-[10px] text-mute">78&apos;</span>
              </div>
            </div>
          </div>

          {/* Event stream — dense rows */}
          <div className="flex flex-col gap-3">
            <span className="label text-mute">Event stream</span>

            <div className="flex min-h-52 flex-col" aria-live="polite">
              {state.feed.map((event) => (
                <div
                  key={`${event.minute}-${event.detail}`}
                  className="flex items-baseline gap-3 border-b border-steel/20 py-2.5 last:border-0"
                >
                  <span className="numeric w-8 shrink-0 text-xs text-mute">
                    {event.minute}
                  </span>
                  <span
                    className={`label w-12 shrink-0 ${
                      event.type === "Goal"
                        ? "text-lime"
                        : event.type === "Card"
                          ? "text-live"
                          : "text-mute"
                    }`}
                  >
                    {event.type}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-sans text-xs text-floodlight/75">
                    {event.detail}
                  </span>
                  {event.xg ? (
                    <span className="numeric shrink-0 text-xs text-floodlight/45">
                      xG {event.xg.toFixed(2)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            <dl className="mt-auto grid grid-cols-3 gap-px border-t border-steel/25 bg-steel/20 pt-px">
              {stats.map((stat) => (
                <div
                  key={stat.k}
                  className="flex flex-col gap-1 bg-surface px-3 py-2.5"
                >
                  <dt className="label text-mute">{stat.k}</dt>
                  <dd className="numeric text-base text-floodlight">{stat.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Panel>
    </section>
  );
}
