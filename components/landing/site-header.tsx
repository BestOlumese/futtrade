import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 -mx-6 border-b border-steel/20 bg-midnight/80 px-6 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="h-4 w-4 bg-lime"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%)" }}
          />
          <span className="label text-floodlight">Empire Live</span>
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="#match-center"
            className="hidden font-sans text-xs text-floodlight/55 transition-colors duration-instant hover:text-lime sm:block"
          >
            Match center
          </Link>
          <Link
            href="#how-it-works"
            className="hidden font-sans text-xs text-floodlight/55 transition-colors duration-instant hover:text-lime sm:block"
          >
            How it works
          </Link>
          <Link
            href="/sign-in"
            className="font-sans text-xs text-floodlight/55 transition-colors duration-instant hover:text-lime"
          >
            Sign in
          </Link>
          <ButtonLink href="/sign-up" className="px-4 py-2 text-xs">
            Start managing
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
