import { SectionHeading } from "./section-heading";

/**
 * Section 6 — the one genuinely ordered sequence on the page, and therefore the
 * only section allowed to be numbered.
 */
const STEPS = [
  { title: "Queue", line: "Enter the queue. Matched on rating, not on luck." },
  { title: "Kickoff", line: "Both managers live, same minute, same pitch." },
  { title: "Live decisions", line: "Change shape, press higher, use your subs — as it happens." },
  { title: "Full time", line: "Every event on record, with the stats to match." },
  { title: "Market reacts", line: "Prices move off what your players actually did." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="flex scroll-mt-24 flex-col gap-10">
      <SectionHeading
        label="How it works"
        title="Queue to settled market in ninety minutes"
      />

      <ol className="grid gap-px bg-steel/25 md:grid-cols-5">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="group relative flex flex-col gap-3 bg-midnight p-5 transition-colors duration-instant hover:bg-surface"
          >
            <span className="numeric text-xs text-lime">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="font-sans text-sm font-semibold text-floodlight">
              {step.title}
            </h3>
            <p className="font-sans text-xs leading-relaxed text-floodlight/50">
              {step.line}
            </p>
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-px scale-x-0 bg-lime transition-transform duration-instant group-hover:scale-x-100"
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
