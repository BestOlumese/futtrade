import Link from "next/link";

/**
 * Footers are navigation, not a design opportunity — the page's one signature
 * move is already spent on the hero. A `steel` top rule and muted text, nothing
 * decorative.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-steel/30 pt-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="eyebrow text-floodlight/45">Empire Live</p>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 font-sans text-sm">
          <Link
            href="/sign-in"
            className="text-floodlight/45 underline-offset-4 hover:text-signal hover:underline"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="text-floodlight/45 underline-offset-4 hover:text-signal hover:underline"
          >
            Create account
          </Link>
          <Link
            href="/terms"
            className="text-floodlight/45 underline-offset-4 hover:text-signal hover:underline"
          >
            Terms
          </Link>
          <Link
            href="/bootstrap"
            className="text-floodlight/45 underline-offset-4 hover:text-signal hover:underline"
          >
            Status
          </Link>
        </nav>
      </div>
    </footer>
  );
}
