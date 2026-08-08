/**
 * Section 7 — the numbers band.
 *
 * The only place on the page where mono type goes large. Values are
 * placeholders until real ones exist; the band earns its place structurally,
 * as the page's one moment of pure data.
 */
const FIGURES = [
  { value: "18,400", label: "Players tracked" },
  { value: "1,200+", label: "Events per match" },
  { value: "90", label: "Minutes, live" },
  { value: "24/7", label: "Market open" },
];

export function NumbersBand() {
  return (
    <section className="grid gap-px border-y border-steel/25 bg-steel/20 sm:grid-cols-2 lg:grid-cols-4">
      {FIGURES.map((figure) => (
        <div
          key={figure.label}
          className="flex flex-col gap-2 bg-midnight px-6 py-8"
        >
          <span className="numeric text-3xl leading-none text-lime">
            {figure.value}
          </span>
          <span className="label text-mute">{figure.label}</span>
        </div>
      ))}
    </section>
  );
}
