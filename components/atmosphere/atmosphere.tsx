/**
 * The generated atmosphere stack — docs/04-design-system.md § Atmosphere.
 *
 * All of it is CSS/SVG: no raster imagery, no licensing, no payload. Layers
 * render back to front, all `pointer-events: none`, all `aria-hidden`.
 *
 * `variant="full"` is for brand surfaces (landing, auth). `variant="quiet"`
 * drops the beams and grid, leaving wash + grain — because beams behind a data
 * table hurt legibility, and legibility always wins.
 */
export function Atmosphere({
  variant = "full",
}: {
  variant?: "full" | "quiet";
}) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      {/* 1. Base wash */}
      <div className="atmos-wash absolute inset-0" />

      {variant === "full" && (
        <>
          {/* 2. Floodlight beams — felt, not seen. */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute -top-1/4 left-[8%] h-[140%] w-[26rem] opacity-[0.05]"
              style={{
                background:
                  "linear-gradient(to bottom, var(--color-floodlight), transparent 65%)",
                transform: "rotate(14deg)",
                filter: "blur(38px)",
              }}
            />
            <div
              className="absolute -top-1/4 right-[14%] h-[130%] w-[20rem] opacity-[0.04]"
              style={{
                background:
                  "linear-gradient(to bottom, var(--color-lime), transparent 60%)",
                transform: "rotate(-11deg)",
                filter: "blur(44px)",
              }}
            />
          </div>

          {/* 3. Pitch grid in perspective — anchors the space as a stadium
              without depicting one. */}
          <div className="absolute inset-x-0 bottom-0 h-[55vh] overflow-hidden [perspective:520px]">
            <div
              className="absolute inset-x-[-50%] bottom-[-30%] h-[150%] opacity-[0.07]"
              style={{
                transform: "rotateX(72deg)",
                backgroundImage:
                  "linear-gradient(to right, var(--color-steel) 1px, transparent 1px), linear-gradient(to bottom, var(--color-steel) 1px, transparent 1px)",
                backgroundSize: "70px 70px",
                maskImage:
                  "linear-gradient(to top, rgba(0,0,0,0.9), transparent 72%)",
                WebkitMaskImage:
                  "linear-gradient(to top, rgba(0,0,0,0.9), transparent 72%)",
              }}
            />
          </div>
        </>
      )}

      {/* 5. Grain over everything */}
      <div className="atmos-grain absolute inset-0" />
    </div>
  );
}

/**
 * Layer 4 — a single accent glow, positioned by the caller.
 * One or two per page, never more: it's the strongest "expensive" signal in
 * the system and it stops working when repeated.
 */
export function Glow({
  className = "",
  live = false,
}: {
  className?: string;
  live?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`atmos-glow ${live ? "atmos-glow-live" : ""} ${className}`}
    />
  );
}
