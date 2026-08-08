import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Actions. A single cut on the bottom-right, never bracketed.
 * `lime` fill with `midnight` text is the correct pairing — never the reverse,
 * and `live` red is only ever used for destructive actions.
 */

const base =
  "cut-btn inline-flex items-center justify-center gap-2 px-6 py-3 font-sans text-sm font-semibold transition-all duration-instant disabled:cursor-not-allowed disabled:opacity-40";

const variants = {
  primary:
    "bg-lime text-midnight hover:brightness-110 hover:shadow-[0_0_28px_-4px_var(--color-lime)]",
  secondary:
    "border border-steel/50 text-floodlight hover:border-lime/70 hover:text-lime",
  ghost: "text-floodlight/60 hover:text-lime",
} as const;

type Variant = keyof typeof variants;

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}
