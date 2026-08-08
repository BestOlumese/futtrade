import type { ReactNode } from "react";

export function SectionHeading({
  label,
  title,
  intro,
}: {
  label: string;
  title: ReactNode;
  intro?: string;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <span className="label flex items-center gap-3 text-lime">
        <span className="h-px w-8 bg-lime/50" aria-hidden="true" />
        {label}
      </span>
      <h2 className="display-xl text-floodlight">{title}</h2>
      {intro ? (
        <p className="font-sans text-base leading-relaxed text-floodlight/55">
          {intro}
        </p>
      ) : null}
    </div>
  );
}
