"use client";

import { Panel } from "@/components/ui/panel";
import { LiveBadge } from "@/components/ui/live-badge";
import { SectionHeading } from "./section-heading";
import { useDemoClock } from "@/lib/demo/clock";
import { matchStateAt, HOME, AWAY } from "@/lib/demo/timeline";

/**
 * Section 2 — the strongest proof the product is real.
 *
 * A working surface shown inside a brand surface, so it takes working-surface
 * density: tight rows, small type, no cuts on individual rows.
 *
 * Everything that happens is drawn ON the pitch, not just written in the feed:
 * shot lines with their xG, a card on the offender, a net flash and badge for
 * the goal. You should be able to watch the viewer alone and know what
 * happened.
 *
 * The ball and players move via CSS transitions between low-frequency state
 * ticks — the same "interpolate between confirmed ticks, never extrapolate"
 * discipline the real viewer will follow.
 */

const SHOT_COLOUR: Record<string, string> = {
  goal: "var(--color-lime)",
  saved: "var(--color-floodlight)",
  blocked: "var(--color-steel)",
  off: "var(--color-steel)",
};

export function MatchCenter() {
  const { t, ref } = useDemoClock<HTMLElement>();
  const state = matchStateAt(t);

  const stats = [
    { k: "Shots", v: String(state.shots) },
    { k: "xG", v: state.xg.toFixed(2) },
    { k: "Passes", v: String(state.passes) },
  ];

  const stopped = state.phase === "stoppage" || state.phase === "slowmo";

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
            <div className="flex items-center justify-between gap-3">
              <LiveBadge />
              <div className="flex items-center gap-3">
                {/* Phase is stated in words too — colour and motion are never
                    the only signal. */}
                {stopped && (
                  <span className="label text-live">
                    {state.phase === "slowmo" ? "Replay" : "Stopped"}
                  </span>
                )}
                {state.phase === "kickoff" && (
                  <span className="label text-lime">Kickoff</span>
                )}
                <span className="numeric text-xs text-floodlight/70">
                  {state.clock} · {state.homeScore}:{state.awayScore}
                </span>
              </div>
            </div>

            {/* 2D viewer */}
            <div
              className="relative aspect-16/10 w-full overflow-hidden border border-steel/30 bg-midnight"
              role="img"
              aria-label={`Two-dimensional match viewer. ${state.clock}, ${HOME.name} ${state.homeScore}, ${AWAY.name} ${state.awayScore}.`}
            >
              {/* Markings */}
              <div className="absolute inset-0" aria-hidden="true">
                <div className="absolute inset-y-0 left-1/2 w-px bg-steel/25" />
                <div className="absolute top-1/2 left-1/2 h-[22%] w-[14%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-steel/25" />
                <div className="absolute top-1/2 left-0 h-[42%] w-[14%] -translate-y-1/2 border-y border-r border-steel/25" />
                <div className="absolute top-1/2 right-0 h-[42%] w-[14%] -translate-y-1/2 border-y border-l border-steel/25" />
              </div>

              {/* Attacking direction, so the pitch orients a first-time viewer */}
              <div
                className="absolute inset-x-2 top-1.5 flex justify-between"
                aria-hidden="true"
              >
                <span className="label text-lime/45">{HOME.short} →</span>
                <span className="label text-floodlight/30">
                  ← {AWAY.short}
                </span>
              </div>

              {/* Net flash on the goal */}
              <div
                aria-hidden="true"
                className={`absolute top-1/2 right-0 h-[42%] w-[6%] -translate-y-1/2 bg-lime transition-opacity duration-300 ${
                  state.netFlash ? "opacity-60" : "opacity-0"
                }`}
              />

              {/* Shot line, with its xG. Drawn in SVG so it can be a real line. */}
              {state.shotLine && (
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full"
                  aria-hidden="true"
                  style={{ opacity: Math.max(0, state.shotLine.strength) }}
                >
                  <line
                    x1={state.shotLine.x1}
                    y1={state.shotLine.y1}
                    x2={state.shotLine.x2}
                    y2={state.shotLine.y2}
                    stroke={SHOT_COLOUR[state.shotLine.outcome]}
                    strokeWidth="1.5"
                    strokeDasharray={
                      state.shotLine.outcome === "goal" ? undefined : "3 2"
                    }
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}
              {state.shotLine && (
                <span
                  aria-hidden="true"
                  className="numeric absolute -translate-x-1/2 -translate-y-1/2 bg-midnight/80 px-1 text-[9px]"
                  style={{
                    left: `${(state.shotLine.x1 + state.shotLine.x2) / 2}%`,
                    top: `${(state.shotLine.y1 + state.shotLine.y2) / 2 - 5}%`,
                    color: SHOT_COLOUR[state.shotLine.outcome],
                    opacity: Math.max(0, state.shotLine.strength),
                  }}
                >
                  xG {state.shotLine.xg.toFixed(2)}
                </span>
              )}

              {/* Ball trail — direction and speed, not just position */}
              {state.ballTrail.map((point, i) => (
                <span
                  key={`trail${i}`}
                  aria-hidden="true"
                  className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-live"
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                    opacity: 0.32 - i * 0.09,
                  }}
                />
              ))}

              {/* Players — circles, larger than the ball */}
              {state.homePlayers.map((player, i) => {
                const onBall =
                  state.holder?.team === "home" && state.holder.idx === i;
                // Flashes at the exact moment possession flips through a
                // challenge, at the spot it happened.
                const tackling =
                  state.tackle?.team === "home" && state.tackle.idx === i;
                return (
                  <span
                    key={`h${i}`}
                    aria-hidden="true"
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime transition-all duration-150 ease-linear ${
                      tackling
                        ? "h-5 w-5 ring-4 ring-lime/35"
                        : `h-3 w-3 ${onBall ? "ring-2 ring-lime/45" : ""}`
                    }`}
                    style={{ left: `${player.x}%`, top: `${player.y}%` }}
                  />
                );
              })}
              {state.awayPlayers.map((player, i) => {
                const onBall =
                  state.holder?.team === "away" && state.holder.idx === i;
                const tackling =
                  state.tackle?.team === "away" && state.tackle.idx === i;
                return (
                  <span
                    key={`a${i}`}
                    aria-hidden="true"
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-floodlight/75 bg-midnight transition-all duration-150 ease-linear ${
                      tackling
                        ? "h-5 w-5 ring-4 ring-floodlight/25"
                        : `h-3 w-3 ${onBall ? "ring-2 ring-floodlight/35" : ""}`
                    }`}
                    style={{ left: `${player.x}%`, top: `${player.y}%` }}
                  />
                );
              })}

              {/* Card on the offender */}
              {state.card && (
                <span
                  aria-hidden="true"
                  className={`absolute h-3.5 w-2.5 translate-x-1.5 -translate-y-1/2 border border-midnight ${
                    state.card.colour === "yellow" ? "bg-card-yellow" : "bg-live"
                  }`}
                  style={{ left: `${state.card.x}%`, top: `${state.card.y}%` }}
                />
              )}

              {/* Ball */}
              <span
                aria-hidden="true"
                className={`absolute z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-live shadow-[0_0_9px_2px_var(--color-live)] transition-all ease-linear ${
                  state.ball.inFlight ? "duration-75" : "duration-150"
                }`}
                style={{ left: `${state.ball.x}%`, top: `${state.ball.y}%` }}
              />

              {/* Goal badge — a compact broadcast bug, so the dots stay visible */}
              {state.goalBadge && (
                <div className="absolute bottom-2 left-2 flex items-center gap-2 border border-lime/50 bg-midnight/85 px-2.5 py-1.5 backdrop-blur-sm">
                  <span className="label text-lime">Goal</span>
                  <span className="font-sans text-[11px] text-floodlight">
                    {state.goalBadge.scorer}
                  </span>
                  <span className="numeric text-[11px] text-floodlight/60">
                    {state.goalBadge.minute} · {state.goalBadge.score}
                  </span>
                </div>
              )}
            </div>

            {/* Momentum — a TIMELINE across the passage, not a scrolling window */}
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
                <span className="numeric text-[10px] text-mute">74&apos;</span>
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
