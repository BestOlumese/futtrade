import type { ReactNode } from "react";

/**
 * The angular panel — the system's signature device.
 * Cuts on two opposing corners (top-left, bottom-right) with a 2px accent
 * tracing the cut edges only. See docs/04-design-system.md § Shape language.
 *
 * `live` switches the accent to `live` red, and must only be used for something
 * genuinely in progress. `brackets` adds HUD corner marks — hero and feature
 * panels only, or they stop meaning anything.
 */
export function Panel({
  children,
  live = false,
  brackets = false,
  className = "",
  bodyClassName = "",
}: {
  children: ReactNode;
  live?: boolean;
  brackets?: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={brackets ? "brackets" : undefined}>
      <div className={`panel ${live ? "panel-live" : ""} ${className}`}>
        <div className={`panel-body ${bodyClassName}`}>{children}</div>
      </div>
    </div>
  );
}
