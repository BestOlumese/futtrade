import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "./section-heading";

/**
 * Section 5 — the Global Bourse.
 *
 * A working surface shown inside a brand surface: tight rows, small type, no
 * cuts on individual rows. A table of angular rows would be noise.
 */

const HOLDINGS = [
  { name: "Adeyemi, K.", pos: "ST", price: 5.19, delta: 0.27, spark: [30, 34, 31, 36, 35, 62, 68, 66] },
  { name: "Mensah, J.", pos: "CM", price: 7.71, delta: 0.03, spark: [52, 55, 51, 58, 60, 57, 62, 63] },
  { name: "Okonkwo, T.", pos: "GK", price: 3.04, delta: -0.11, spark: [48, 46, 49, 44, 41, 43, 38, 36] },
  { name: "Traoré, S.", pos: "LB", price: 2.88, delta: 0.14, spark: [22, 25, 24, 28, 31, 30, 34, 37] },
  { name: "Bello, A.", pos: "RW", price: 6.42, delta: -0.05, spark: [61, 59, 63, 60, 58, 61, 57, 55] },
];

function Sparkline({ points, rising }: { points: number[]; rising: boolean }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const path = points
    .map((value, i) => {
      const x = (i / (points.length - 1)) * 100;
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

const CANDLES = [
  { o: 30, c: 34 }, { o: 34, c: 31 }, { o: 31, c: 36 }, { o: 36, c: 35 },
  { o: 35, c: 33 }, { o: 33, c: 38 }, { o: 38, c: 62, spike: true },
  { o: 62, c: 68 }, { o: 68, c: 65 }, { o: 65, c: 71 }, { o: 71, c: 69 },
  { o: 69, c: 74 },
];

export function Bourse() {
  return (
    <section className="flex flex-col gap-10">
      <SectionHeading
        label="The Global Bourse"
        title="Prices that move because someone played"
        intro="A two-sided market in player shares. Every movement traces back to a real event in a real match — never to random noise."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
        {/* Market table — dense */}
        <Panel bodyClassName="p-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="label text-mute">Your holdings</span>
              <span className="numeric text-xs text-lime">+2.4%</span>
            </div>

            <table className="w-full">
              <thead>
                <tr className="border-b border-steel/25">
                  <th className="label pb-2 text-left text-mute">Player</th>
                  <th className="label pb-2 text-right text-mute">Price</th>
                  <th className="label pb-2 text-right text-mute">24h</th>
                  <th className="label pb-2 text-right text-mute">Trend</th>
                </tr>
              </thead>
              <tbody>
                {HOLDINGS.map((row) => {
                  const rising = row.delta >= 0;
                  return (
                    <tr
                      key={row.name}
                      className="border-b border-steel/15 transition-colors duration-instant last:border-0 hover:bg-surface-2"
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
                        className={`numeric py-2.5 text-right text-xs ${rising ? "text-lime" : "text-live"}`}
                      >
                        {rising ? "▲ +" : "▼ −"}
                        {Math.abs(row.delta).toFixed(2)}
                      </td>
                      <td className="py-2.5">
                        <div className="flex justify-end">
                          <Sparkline points={row.spark} rising={rising} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Price chart with the event that caused the spike */}
        <Panel bodyClassName="p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="label text-mute">Adeyemi, K. · 30d</span>
              <span className="numeric text-2xl leading-none text-floodlight">
                £5.19
              </span>
            </div>
            <span className="numeric text-sm text-lime">▲ +68.2%</span>
          </div>

          <div className="relative flex h-40 items-end gap-1.5" aria-hidden="true">
            {CANDLES.map((candle, i) => {
              const rising = candle.c >= candle.o;
              const bottom = Math.min(candle.o, candle.c);
              const height = Math.max(Math.abs(candle.c - candle.o), 2);
              return (
                <div key={i} className="relative h-full flex-1">
                  <span
                    className={`absolute w-full ${
                      rising ? "bg-lime" : "bg-live"
                    } ${candle.spike ? "" : "opacity-60"}`}
                    style={{ bottom: `${bottom}%`, height: `${height}%` }}
                  />
                </div>
              );
            })}

            {/* The event marker sits on the spike — the whole point of the
                section is that the two are the same thing. */}
            <div
              className="absolute inset-y-0 border-l border-dashed border-lime/45"
              style={{ left: "52%" }}
            />
          </div>

          <div className="flex items-center gap-3 border-t border-steel/25 pt-3">
            <span className="label shrink-0 text-lime">Cause</span>
            <span className="font-sans text-xs text-floodlight/70">
              Hat-trick vs. Ikorodu FC · 12 Aug
            </span>
          </div>
        </Panel>
      </div>
    </section>
  );
}
