import { Panel } from "@/components/ui/panel";

/**
 * Section 2 — three pillars, shown not told.
 *
 * Each panel demonstrates one mechanic with a concrete example instead of
 * listing features. Deliberately NOT numbered: order doesn't matter here, so
 * numbering would be decoration rather than structure. The numbered sequence
 * later on the page is the real one.
 */

/** Tactical dials as segmented meters — terminal vocabulary, sharp edges. */
function Dial({ label, filled }: { label: string; filled: number }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow text-floodlight/45">{label}</span>
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={`h-2 flex-1 ${i < filled ? "bg-signal" : "bg-steel/40"}`}
          />
        ))}
      </div>
    </div>
  );
}

function TacticsPillar() {
  return (
    <Panel className="h-full">
      <div className="flex h-full flex-col gap-5 p-6">
        <h3 className="display-sm text-floodlight">Tactics that matter live</h3>

        <div className="flex flex-col gap-4">
          <Dial label="Mentality" filled={3} />
          <Dial label="Pressing" filled={4} />
        </div>

        <p className="mt-auto font-sans text-sm leading-relaxed text-floodlight/60">
          Push pressing up. Concede space in behind.
        </p>
      </div>
    </Panel>
  );
}

function DevelopmentPillar() {
  const attributes = [
    { name: "Finishing", before: 62, after: 65, change: "+3" },
    { name: "Composure", before: 58, after: 60, change: "+2" },
  ];

  return (
    <Panel className="h-full">
      <div className="flex h-full flex-col gap-5 p-6">
        <h3 className="display-sm text-floodlight">
          A squad that actually develops
        </h3>

        <dl className="flex flex-col gap-4">
          {attributes.map((attribute) => (
            <div key={attribute.name} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="font-sans text-sm text-floodlight/70">
                  {attribute.name}
                </dt>
                <dd className="numeric text-sm text-floodlight">
                  {attribute.before} → {attribute.after}{" "}
                  <span className="text-signal">{attribute.change}</span>
                </dd>
              </div>
              <div className="relative h-2 bg-steel/40" aria-hidden="true">
                <span
                  className="absolute inset-y-0 left-0 bg-steel"
                  style={{ width: `${attribute.before}%` }}
                />
                <span
                  className="absolute inset-y-0 bg-signal"
                  style={{
                    left: `${attribute.before}%`,
                    width: `${attribute.after - attribute.before}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </dl>

        <p className="mt-auto font-sans text-sm leading-relaxed text-floodlight/60">
          +3 Finishing this month, from minutes actually played.
        </p>
      </div>
    </Panel>
  );
}

function MarketPillar() {
  // A price fragment with the spike sitting on the labeled event.
  const bars = [
    { open: 30, close: 34 },
    { open: 34, close: 31 },
    { open: 31, close: 36 },
    { open: 36, close: 35 },
    { open: 35, close: 62, spike: true },
    { open: 62, close: 68 },
    { open: 68, close: 66 },
  ];

  return (
    <Panel className="h-full">
      <div className="flex h-full flex-col gap-5 p-6">
        <h3 className="display-sm text-floodlight">
          A market that reacts to what happens
        </h3>

        <div className="flex h-28 items-end gap-2" aria-hidden="true">
          {bars.map((bar, i) => {
            const rising = bar.close >= bar.open;
            const bottom = Math.min(bar.open, bar.close);
            const height = Math.max(Math.abs(bar.close - bar.open), 3);
            return (
              <div key={i} className="relative h-full flex-1">
                <span
                  className={`absolute w-full ${rising ? "bg-signal" : "bg-tally"} ${
                    bar.spike ? "" : "opacity-70"
                  }`}
                  style={{ bottom: `${bottom}%`, height: `${height}%` }}
                />
              </div>
            );
          })}
        </div>

        <p className="mt-auto font-sans text-sm leading-relaxed text-floodlight/60">
          Hat-trick vs. Ikorodu FC — the spike is that match, not noise.
        </p>
      </div>
    </Panel>
  );
}

export function Pillars() {
  return (
    <section className="grid gap-5 md:grid-cols-3">
      <TacticsPillar />
      <DevelopmentPillar />
      <MarketPillar />
    </section>
  );
}
