/**
 * Placeholder club marks — geometric devices, never crests.
 * Flat shapes, sharp edges, no gradients: the same vocabulary as stadium
 * signage rather than football-brand cliché.
 */
export function ClubMark({
  variant,
  className = "",
}: {
  variant: "home" | "away";
  className?: string;
}) {
  const color =
    variant === "home" ? "var(--color-lime)" : "var(--color-floodlight)";
  const opacity = variant === "home" ? 1 : 0.65;

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className} fill="none">
      <g opacity={opacity}>
        <path
          d="M4 3h24v17.5L16 29 4 20.5V3Z"
          fill={color}
          opacity="0.12"
        />
        <path
          d="M4 3h24v17.5L16 29 4 20.5V3Z"
          stroke={color}
          strokeWidth="1.5"
        />
        {variant === "home" ? (
          <path d="M11 12h10M11 17h10M11 22h6" stroke={color} strokeWidth="2" />
        ) : (
          <path d="M16 9l6.5 11h-13L16 9Z" stroke={color} strokeWidth="2" />
        )}
      </g>
    </svg>
  );
}
