import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/landing/site-footer";

export const metadata: Metadata = {
  title: "Terms of play — Empire Live",
  description: "The terms that apply to playing Empire Live.",
};

/**
 * Placeholder. Sign-up and the footer both link here, so the route exists
 * rather than 404-ing — but the actual terms are a legal question, not a
 * design one, and are not written yet.
 */
export default function TermsPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-16 px-6 py-16">
      <main className="flex flex-col gap-6">
        <p className="label text-floodlight/45">Empire Live</p>
        <h1 className="display-lg text-floodlight">Terms of play</h1>
        <p className="max-w-xl font-sans text-base leading-relaxed text-floodlight/60">
          Not written yet. Empire Live is in development and not open to
          players, so there is nothing here to agree to.
        </p>
        <p className="max-w-xl font-sans text-base leading-relaxed text-floodlight/60">
          When accounts open, this page will cover what happens to your club and
          your holdings on the Bourse — the two things worth reading before you
          spend time on either.
        </p>
        <Link
          href="/"
          className="font-sans text-sm text-lime underline-offset-4 hover:underline"
        >
          Back to the landing page
        </Link>
      </main>

      <SiteFooter />
    </div>
  );
}
