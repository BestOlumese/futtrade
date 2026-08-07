import type { ButtonHTMLAttributes } from "react";

/**
 * Primary action. `signal` fill, `void` text, full-width within its panel,
 * sharp corners. `signal` carries almost all interactivity in the system —
 * `tally` is never used for a generic CTA.
 */
export function Button({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`w-full bg-signal px-4 py-2.5 font-sans text-sm font-semibold text-void transition-opacity duration-[120ms] hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
