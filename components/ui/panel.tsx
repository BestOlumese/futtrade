import type { ReactNode } from "react";

/**
 * The clipped panel — the system's signature structural device.
 * One chamfered corner (top-left), a `steel` edge, and a 2px edge-line tracing
 * the chamfer only. See docs/04-design-system.md § Layout signature.
 *
 * `live` switches the edge-line to `tally`, and must only be used for something
 * genuinely in progress.
 */
export function Panel({
  children,
  live = false,
  className = "",
}: {
  children: ReactNode;
  live?: boolean;
  className?: string;
}) {
  return (
    <div className={`panel ${live ? "panel-live" : ""} ${className}`}>
      <div className="panel-body">{children}</div>
    </div>
  );
}
