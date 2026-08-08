"use client";

import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "./section-heading";
import { useDemoClock } from "@/lib/demo/clock";
import {
  matchStateAt,
  candlesAt,
  priceAt,
  TRACKED_PLAYER,
} from "@/lib/demo/timeline";

/**
 * Section 5 — the Global Bourse.
 *
 * A working surface shown inside a brand surface: tight rows, small type, no
 * cuts on individual rows.
 *
 * The chart is intraday and live. Only the rightmost candle moves — it grows as
 * the price does, then closes and a new one opens. Past candles are frozen,
 * because in a real market past prices don't change, and the whole point of the
 * section is that the chart is a record rather than decoration.
 *
 * The goal in the event stream is what causes the spike. It happens on screen:
 * watch the feed in the match center and the candle here move together.
 */

/** Other holdings drift off the same clock so the table is never static. */
const OTHERS = [
  { name: "T. Marek", pos: "CM", base: 7.71, phase: 0.0, amp: 0.09 },
  { name: "R. Voss", pos: "GK", base: 3.04, phase: 1.7, amp: 0.05 },
  { name: "J. Kavan", pos: "LB", base: 2.88, phase: 3.1, amp: 0.06 },
  { name: "S. Orsi", pos: "RW", base: 6.42, phase: 4.6, amp: 0.11 },
];

function Sparkline({
  values,
  rising,
}: {
  values: number[];
  rising: boolean;
}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const path = values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 100 - ((value - min) / (max - min || 1)) * 100;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="h-6 w-16"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke={rising ? "var(--color-lime)" : "var(--color-live)"}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function Bourse() {
  const { t, ref } = useDemoClock<HTMLElement>();
  const state = matchStateAt(t);
  const candles = candlesAt(t);

  const drawn = candles.filter((candle) => Number.isFinite(candle.open));
  const high = Math.max(...drawn.map((c) => c.high));
  const low = Math.min(...drawn.map((c) => c.low));
  const span = high - low || 1;
  const pct = (value: number) => ((value - low) / span) * 100;

  const rising = state.priceDelta >= 0;

  const holdings = [
    {
      name: TRACKED_PLAYER,
      pos: "ST",
      price: state.price,
      delta: state.priceDelta,
      spark: Array.from({ length: 10 }, (_, i) =>
        priceAt(Math.max(0, t - (9 - i) * 4000)),
      ),
      tracked: true,
    },
    ...OTHERS.map((player) => {
      const s = t / 1000;
      const price =
        player.base + Math.sin(s * 0.42 + player.phase) * player.amp;
      const previous =
        player.base + Math.sin((s - 8) * 0.42 + player.phase) * player.amp;
      return {
        name: player.name,
        pos: player.pos,
        price,
        delta: price - previous,
        spark: Array.from(
          { length: 10 },
          (_, i) =>
            player.base +
            Math.sin((s - (9 - i) * 4) * 0.42 + player.phase) * player.amp,
        ),
        tracked: false,
      };
    }),
  ];

  const portfolio = holdings.reduce((sum, h) => sum + h.delta, 0);

  return (
    <section ref={ref} className="flex flex-col gap-10">
      <SectionHeading
        label="The Global Bourse"
        title="Prices that move because someone played"
        intro="A two-sided market in player shares. Every movement traces back to a real event in a real match — never to random noise."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
        {/* Market table */}
        <Panel bodyClassName="p-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="label text-mute">Your holdings</span>
              <span
                className={`numeric text-xs ${portfolio >= 0 ? "text-lime" : "text-live"}`}
              >
                {portfolio >= 0 ? "▲ +" : "▼ −"}
                {Math.abs(portfolio).toFixed(2)}
              </span>
            </div>

            <table className="w-full">
              <thead>
                <tr className="border-b border-steel/25">
                  <th className="label pb-2 text-left text-mute">Player</th>
                  <th className="label pb-2 text-right text-mute">Price</th>
                  <th className="label pb-2 text-right text-mute">Move</th>
                  <th className="label pb-2 text-right text-mute">Trend</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((row) => {
                  const up = row.delta >= 0;
                  return (
                    <tr
                      key={row.name}
                      className={`border-b border-steel/15 transition-colors duration-instant last:border-0 hover:bg-surface-2 ${
                        row.tracked ? "bg-lime/[0.04]" : ""
                      }`}
                    >
                      <td className="py-2.5">
                        <div className="flex items-baseline gap-2">
                          <span className="font-sans text-xs text-floodlight">
                            {row.name}
                          </span>
                          <span className="numeric text-[10px] text-mute">
                            {row.pos}
                          </span>
                        </div>
                      </td>
                      <td className="numeric py-2.5 text-right text-xs text-floodlight">
                        £{row.price.toFixed(2)}
                      </td>
                      <td
                        className={`numeric py-2.5 text-right text-xs ${up ? "text-lime" : "text-live"}`}
                      >
                        {up ? "▲ +" : "▼ −"}
                        {Math.abs(row.delta).toFixed(2)}
                      </td>
                      <td className="py-2.5">
                        <div className="flex justify-end">
                          <Sparkline values={row.spark} rising={up} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Live intraday chart */}
        <Panel bodyClassName="p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="label text-mute">
                {TRACKED_PLAYER} · live
              </span>
              <span className="numeric text-2xl leading-none text-floodlight">
                £{state.price.toFixed(2)}
              </span>
            </div>
            <span
              className={`numeric text-sm ${rising ? "text-lime" : "text-live"}`}
            >
              {rising ? "▲ +" : "▼ −"}
              {Math.abs(state.priceDelta).toFixed(2)}
            </span>
          </div>

          <div
            className="relative flex h-44 items-stretch gap-1.5"
            role="img"
            aria-label={`Live price chart for ${TRACKED_PLAYER}, currently £${state.price.toFixed(2)}.`}
          >
            {candles.map((candle, i) => {
              if (!Number.isFinite(candle.open)) {
                return <div key={i} className="flex-1" />;
              }
              const up = candle.close >= candle.open;
              const bodyBottom = pct(Math.min(candle.open, candle.close));
              const bodyHeight = Math.max(
                pct(Math.max(candle.open, candle.close)) - bodyBottom,
                1.2,
              );
              const wickBottom = pct(candle.low);
              const wickHeight = Math.max(pct(candle.high) - wickBottom, 1.2);

              return (
                <div key={i} className="relative flex-1">
                  {/* Wick */}
                  <span
                    aria-hidden="true"
                    className={`absolute left-1/2 w-px -translate-x-1/2 ${up ? "bg-lime/50" : "bg-live/50"}`}
                    style={{
                      bottom: `${wickBottom}%`,
                      height: `${wickHeight}%`,
                    }}
                  />
                  {/* Body — only the live one animates */}
                  <span
                    aria-hidden="true"
                    className={`absolute w-full ${up ? "bg-lime" : "bg-live"} ${
                      candle.live
                        ? "transition-all duration-150 ease-linear"
                        : "opacity-60"
                    }`}
                    style={{
                      bottom: `${bodyBottom}%`,
                      height: `${bodyHeight}%`,
                    }}
                  />
                  {candle.live && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-2 h-px bg-lime"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 border-t border-steel/25 pt-3">
            <span className="label shrink-0 text-lime">Cause</span>
            <span className="min-w-0 flex-1 truncate font-sans text-xs text-floodlight/70">
              {state.cause
                ? `${state.cause.label} · ${state.cause.minute}`
                : "No move yet this passage"}
            </span>
          </div>
        </Panel>
      </div>
    </section>
  );
}
