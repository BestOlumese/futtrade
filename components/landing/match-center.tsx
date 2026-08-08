import { Panel } from "@/components/ui/panel";
import { LiveBadge } from "@/components/ui/live-badge";
import { SectionHeading } from "./section-heading";

/**
 * Section 2 — the strongest proof the product is real.
 *
 * This is a working surface shown inside a brand surface, so it uses
 * working-surface density: tight rows, small type, no cuts on individual rows.
 * It is meant to look busy in a way the rest of the page doesn't — that's the
 * honest preview.
 */

// Positions as percentages of the pitch box. Home shape left, away shape right.
const HOME = [
  [8, 50], [22, 20], [22, 40], [22, 60], [22, 80],
  [38, 30], [38, 50], [38, 70], [52, 22], [52, 50], [52, 78],
];
const AWAY = [
  [92, 50], [78, 22], [78, 42], [78, 62], [78, 82],
  [64, 32], [64, 50], [64, 68], [50, 34], [48, 62], [46, 48],
];

const EVENTS = [
  { min: "73'", type: "Tackle", detail: "Mensah wins possession", value: null },
  { min: "71'", type: "Goal", detail: "Adeyemi · left foot", value: "xG 0.44" },
  { min: "70'", type: "Shot", detail: "Okonkwo · blocked", value: "xG 0.09" },
  { min: "68'", type: "Sub", detail: "Bello for Traoré", value: null },
  { min: "66'", type: "Save", detail: "Eze · low right", value: "xG 0.31" },
  { min: "64'", type: "Card", detail: "Adeyemi · dissent", value: null },
];

const MOMENTUM = [12, -8, 24, 18, -14, -6, 30, 42, 22, -10, 16, 38, 28, -4, 20];

export function MatchCenter() {
  return (
    <section id="match-center" className="flex scroll-mt-24 flex-col gap-10">
      <SectionHeading
        label="Match center"
        title="Ninety minutes you can actually read"
        intro="One event stream drives all of it — the 2D viewer, the stats, player form, and every price on the market. Nothing here is reconstructed after the fact."
      />

      <Panel bodyClassName="p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Pitch */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <LiveBadge />
              <span className="numeric text-xs text-floodlight/70">
                73:04 · 2:1
              </span>
            </div>

            <div
              className="relative aspect-[16/10] w-full border border-steel/30 bg-midnight"
              aria-label="Two-dimensional match viewer showing player positions"
              role="img"
            >
              {/* Pitch markings */}
              <div className="absolute inset-0" aria-hidden="true">
                <div className="absolute inset-y-0 left-1/2 w-px bg-steel/25" />
                <div className="absolute top-1/2 left-1/2 h-[22%] w-[14%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-steel/25" />
                <div className="absolute top-1/2 left-0 h-[42%] w-[14%] -translate-y-1/2 border-y border-r border-steel/25" />
                <div className="absolute top-1/2 right-0 h-[42%] w-[14%] -translate-y-1/2 border-y border-l border-steel/25" />
              </div>

              {HOME.map(([x, y], i) => (
                <span
                  key={`h${i}`}
                  aria-hidden="true"
                  className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-lime"
                  style={{ left: `${x}%`, top: `${y}%` }}
                />
              ))}
              {AWAY.map(([x, y], i) => (
                <span
                  key={`a${i}`}
                  aria-hidden="true"
                  className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 border border-floodlight/70"
                  style={{ left: `${x}%`, top: `${y}%` }}
                />
              ))}
              {/* Ball */}
              <span
                aria-hidden="true"
                className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-live"
                style={{ left: "47%", top: "54%" }}
              />
            </div>

            {/* Momentum */}
            <div className="flex flex-col gap-2">
              <span className="label text-mute">Momentum</span>
              <div
                className="flex h-12 items-center gap-[3px]"
                aria-hidden="true"
              >
                {MOMENTUM.map((value, i) => (
                  <div key={i} className="relative h-full flex-1">
                    <span
                      className={`absolute left-0 w-full ${value >= 0 ? "bg-lime/80" : "bg-floodlight/25"}`}
                      style={
                        value >= 0
                          ? { bottom: "50%", height: `${Math.abs(value)}%` }
                          : { top: "50%", height: `${Math.abs(value)}%` }
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Event feed — dense rows, no cuts */}
          <div className="flex flex-col gap-3">
            <span className="label text-mute">Event stream</span>
            <div className="flex flex-col">
              {EVENTS.map((event, i) => (
                <div
                  key={i}
                  className="flex items-baseline gap-3 border-b border-steel/20 py-2.5 last:border-0"
                >
                  <span className="numeric w-8 shrink-0 text-xs text-mute">
                    {event.min}
                  </span>
                  <span
                    className={`label w-12 shrink-0 ${
                      event.type === "Goal"
                        ? "text-lime"
                        : event.type === "Card"
                          ? "text-live"
                          : "text-floodlight/45"
                    }`}
                  >
                    {event.type}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-sans text-xs text-floodlight/75">
                    {event.detail}
                  </span>
                  {event.value ? (
                    <span className="numeric shrink-0 text-xs text-floodlight/45">
                      {event.value}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            <dl className="mt-auto grid grid-cols-3 gap-px border-t border-steel/25 bg-steel/20 pt-px">
              {[
                { k: "Shots", v: "14" },
                { k: "xG", v: "1.82" },
                { k: "Passes", v: "487" },
              ].map((stat) => (
                <div
                  key={stat.k}
                  className="flex flex-col gap-1 bg-surface px-3 py-2.5"
                >
                  <dt className="label text-mute">{stat.k}</dt>
                  <dd className="numeric text-base text-floodlight">
                    {stat.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Panel>
    </section>
  );
}
