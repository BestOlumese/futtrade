"use client";

/**
 * A tactical dial: a segmented control, not a slider.
 *
 * Three named settings that trade off against each other — a slider would imply
 * a continuum and, worse, imply that further right is better. Each option
 * carries its cost in the caption, because a dial whose downside is invisible
 * reads as "be better" and stops being a decision.
 */
export function DialControl<T extends string>({
  label,
  options,
  value,
  captions,
  onChange,
  disabled,
}: {
  label: string;
  options: readonly T[];
  value: T;
  captions: Record<T, string>;
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="label text-mute">{label}</span>

      <div
        className="grid gap-px bg-steel/30"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(option)}
              className={`px-3 py-2.5 font-sans text-xs font-semibold capitalize transition-colors duration-instant disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? "bg-lime text-midnight"
                  : "bg-surface-2 text-floodlight/70 hover:text-floodlight"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>

      <p className="font-sans text-xs leading-relaxed text-floodlight/45">
        {captions[value]}
      </p>
    </div>
  );
}
