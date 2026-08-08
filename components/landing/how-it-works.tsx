/**
 * Section 3 — how a live match actually works.
 *
 * This numbering is earned: it's a genuine temporal sequence, unlike the three
 * pillars above where order doesn't matter. One short line per step — the job
 * is to make the mechanic legible at a glance, not to sell it.
 */

const STEPS = [
  { title: "Queue", line: "Enter the queue. Matched on rating, not on luck." },
  { title: "Kickoff", line: "Both managers live, same minute, same pitch." },
  {
    title: "Live decisions",
    line: "Change shape, press higher, use your subs — while it's happening.",
  },
  { title: "Full time", line: "Every event on record, with the stats to match." },
  {
    title: "Market reacts",
    line: "Prices move off what your players actually did.",
  },
];

export function HowItWorks() {
  return (
    <section className="flex flex-col gap-8">
      <h2 className="display-lg max-w-2xl text-floodlight">
        How a live match actually works
      </h2>

      <ol className="grid gap-px bg-steel/30 md:grid-cols-5">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex flex-col gap-3 bg-void p-5">
            <span className="numeric text-xs text-signal">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="font-sans text-base font-semibold text-floodlight">
              {step.title}
            </h3>
            <p className="font-sans text-sm leading-relaxed text-floodlight/55">
              {step.line}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
