import Link from "next/link";

/**
 * Holding page. The real landing page is docs/05-landing-page.md, with its
 * running-clock hero — that's a later phase. Phase 00 scopes UI to auth screens
 * only, so this stays deliberately bare rather than half-building that spec.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-void px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-display text-6xl leading-none font-extrabold tracking-tight text-floodlight">
          Empire Live
        </h1>
        <p className="max-w-md font-sans text-sm text-floodlight/55">
          Manage a club, play live matches, and trade the players who decide
          them.
        </p>
      </div>

      <nav className="flex items-center gap-6 font-sans text-sm">
        <Link
          href="/sign-in"
          className="text-signal underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="text-floodlight/55 underline-offset-4 hover:text-signal hover:underline"
        >
          Create account
        </Link>
        <Link
          href="/bootstrap"
          className="text-floodlight/55 underline-offset-4 hover:text-signal hover:underline"
        >
          Bootstrap status
        </Link>
      </nav>
    </main>
  );
}
