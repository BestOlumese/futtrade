import type { InputHTMLAttributes } from "react";

/**
 * Form input. Plain rectangle — cuts are for containers and actions, not for
 * every element. `surface-2` fill, `steel` border, `lime` focus ring.
 */
export function Field({
  label,
  hint,
  id,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="label text-mute">
        {label}
      </label>
      <input
        id={id}
        className="border border-steel/40 bg-surface-2 px-3.5 py-3 font-sans text-sm text-floodlight transition-colors duration-instant placeholder:text-floodlight/30 hover:border-steel/70"
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
