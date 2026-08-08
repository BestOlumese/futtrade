import Link from "next/link";

/**
 * Navigation, not decoration. No atmosphere here — the page's budget is spent
 * on the hero.
 */
export function SiteFooter() {
  return (
    <footer className="flex flex-col gap-6 border-t border-steel/25 pt-8 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="label text-lime">FUTTRADE</span>
        <span className="font-sans text-xs text-floodlight/35">
          In development. Not open to players yet.
        </span>
      </div>

      <nav className="flex flex-wrap gap-x-6 gap-y-2 font-sans text-xs">
        {[
          { href: "/sign-in", label: "Sign in" },
          { href: "/sign-up", label: "Create account" },
          { href: "/terms", label: "Terms" },
          { href: "/bootstrap", label: "Status" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-floodlight/40 transition-colors duration-instant hover:text-lime"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
