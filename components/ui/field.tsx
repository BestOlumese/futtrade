import type { InputHTMLAttributes } from "react";

/**
 * Form input. Sharp corners — the chamfer is reserved for panels, never applied
 * to inputs or buttons. `steel` border, `signal` focus ring (the focus ring is
 * global, in globals.css).
 */
export function Field({
  label,
  hint,
  id,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="font-sans text-xs font-medium tracking-wide text-floodlight/70 uppercase"
      >
        {label}
      </label>
      <input
        id={id}
        className="border border-steel/60 bg-void px-3 py-2.5 font-sans text-sm text-floodlight placeholder:text-floodlight/35"
        {...props}
      />
      {hint ? (
        <p className="font-sans text-xs leading-relaxed text-floodlight/45">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
