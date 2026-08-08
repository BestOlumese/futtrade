/**
 * The live badge. The dot models a broadcast tally light and means live, and
 * only live — never decorative.
 *
 * The word "LIVE" is always rendered alongside it: color is never the only
 * signal, and a reduced-motion user (whose pulse is disabled) must still be
 * able to tell that something is in progress.
 */
export function LiveBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="live-dot" />
      <span className="label text-live">Live</span>
    </span>
  );
}
