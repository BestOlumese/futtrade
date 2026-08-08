import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "./section-heading";

/**
 * Sections 3 and 4 — tactics and development.
 *
 * Unordered: these are never numbered. The Queue → Market sequence later on the
 * page is the only real sequence, and numbering here would dilute it.
 */

function Dial({ label, filled, of = 6 }: { label: string; filled: number; of?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="label text-mute">{label}</span>
        <span className="numeric text-xs text-lime">
          {filled}/{of}
        </span>
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: of }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 ${i < filled ? "bg-lime" : "bg-steel/35"}`}
          />
        ))}
      </div>
    </div>
  );
}

const CA_POINTS = [118, 121, 120, 126, 131, 129, 136, 141, 144, 149];

function CaChart() {
  const min = Math.min(...CA_POINTS);
  const max = Math.max(...CA_POINTS);
  const path = CA_POINTS.map((value, i) => {
    const x = (i / (CA_POINTS.length - 1)) * 100;
    const y = 100 - ((value - min) / (max - min)) * 100;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="h-24 w-full"
      aria-hidden="true"
    >
      <path
        d={`${path} L100,100 L0,100 Z`}
        fill="var(--color-lime)"
        opacity="0.12"
      />
      <path d={path} fill="none" stroke="var(--color-lime)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function TacticsAndDevelopment() {
  return (
    <section className="flex flex-col gap-10">
      <SectionHeading
        label="Tactics & development"
        title="Decisions with consequences you can see"
        intro="Dials that trade one thing for another, and players whose attributes genuinely move because of minutes they actually played."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel bodyClassName="p-6 flex flex-col gap-6">
          <h3 className="display-md text-floodlight">Tactics that matter live</h3>

          <div className="flex flex-col gap-4">
            <Dial label="Mentality" filled={4} />
            <Dial label="Pressing" filled={5} />
            <Dial label="Tempo" filled={3} />
          </div>

          <div className="mt-auto border-l-2 border-lime/60 pl-4">
            <p className="font-sans text-sm leading-relaxed text-floodlight/70">
              Push pressing up.{" "}
              <span className="text-floodlight/45">
                Concede space in behind.
              </span>
            </p>
          </div>
        </Panel>

        <Panel bodyClassName="p-6 flex flex-col gap-6">
          <div className="flex items-start justify-between gap-4">
            <h3 className="display-md text-floodlight">
              A squad that develops
            </h3>
            <div className="flex flex-col items-end">
              <span className="label text-mute">CA</span>
              <span className="numeric text-2xl leading-none text-lime">149</span>
            </div>
          </div>

          <CaChart />

          <dl className="flex flex-col">
            {[
              { k: "Finishing", v: "62 → 65", d: "+3" },
              { k: "Composure", v: "58 → 60", d: "+2" },
              { k: "Stamina", v: "71 → 70", d: "−1" },
            ].map((row) => (
              <div
                key={row.k}
                className="flex items-baseline justify-between border-b border-steel/20 py-2 last:border-0"
              >
                <dt className="font-sans text-xs text-floodlight/70">{row.k}</dt>
                <dd className="flex items-baseline gap-3">
                  <span className="numeric text-xs text-floodlight/45">
                    {row.v}
                  </span>
                  <span
                    className={`numeric w-8 text-right text-xs ${
                      row.d.startsWith("+") ? "text-lime" : "text-live"
                    }`}
                  >
                    {row.d}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-auto font-sans text-sm leading-relaxed text-floodlight/55">
            +3 Finishing this month — from minutes actually played, not a dice
            roll.
          </p>
        </Panel>
      </div>
    </section>
  );
}
