/**
 * Placeholder club marks — simple geometric devices, not crests.
 * The design system rules out crest clichés and stock imagery, so these are
 * built from the same vocabulary as stadium signage: flat shapes, sharp edges,
 * no gradients.
 */
export function ClubMark({
  variant,
  className = "",
}: {
  variant: "home" | "away";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      {variant === "home" ? (
        <>
          <path d="M2 2h28v20L16 30 2 22V2Z" fill="var(--color-signal)" opacity="0.16" />
          <path d="M2 2h28v20L16 30 2 22V2Z" stroke="var(--color-signal)" strokeWidth="1.5" />
          <path d="M10 11h12M10 16h12M10 21h7" stroke="var(--color-signal)" strokeWidth="2" />
        </>
      ) : (
        <>
          <path d="M2 2h28v20L16 30 2 22V2Z" fill="var(--color-floodlight)" opacity="0.1" />
          <path d="M2 2h28v20L16 30 2 22V2Z" stroke="var(--color-floodlight)" strokeWidth="1.5" opacity="0.6" />
          <path d="M16 8l7 12H9l7-12Z" stroke="var(--color-floodlight)" strokeWidth="2" opacity="0.75" />
        </>
      )}
    </svg>
  );
}
