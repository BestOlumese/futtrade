import type { ReactNode } from "react";
import Link from "next/link";
import { Atmosphere, Glow } from "@/components/atmosphere/atmosphere";

/**
 * Auth shell. Atmosphere layers 1, 2 and 5 — wash, faint beams, grain — plus a
 * single glow behind the panel. No pitch grid, no parallax: that's the landing
 * page's budget, not this one's.
 *
 * The previous version put a bare panel on a flat field and read as unfinished.
 * See docs/06-auth-pages.md.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Atmosphere variant="full" />

      <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
        <Glow className="top-1/4 left-1/2 h-96 w-96 -translate-x-1/2" />

        <div className="relative w-full max-w-110">{children}</div>

        <Link
          href="/"
          className="relative font-sans text-xs text-floodlight/35 transition-colors duration-instant hover:text-lime"
        >
          ← Back to Empire Live
        </Link>
      </main>
    </>
  );
}
