import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

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
      className={`w-full bg-signal px-4 py-2.5 font-sans text-sm font-semibold text-void transition-opacity duration-instant hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Same treatment as Button, for navigation rather than an action.
 * `secondary` keeps `signal` as the accent but drops the fill — `tally` is
 * never used to differentiate a CTA, only liveness.
 */
export function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const styles =
    variant === "primary"
      ? "bg-signal text-void hover:opacity-85"
      : "border border-steel/60 text-floodlight hover:border-signal hover:text-signal";

  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center px-6 py-3 font-sans text-sm font-semibold transition-colors duration-instant ${styles}`}
    >
      {children}
    </Link>
  );
}
