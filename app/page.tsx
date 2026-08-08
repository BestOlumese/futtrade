import type { Metadata } from "next";
import { HeroMatchCard } from "@/components/landing/hero-match-card";
import { Pillars } from "@/components/landing/pillars";
import { HowItWorks } from "@/components/landing/how-it-works";
import { SiteFooter } from "@/components/landing/site-footer";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Empire Live — real matches, real managers, a market that moves",
  description:
    "Manage a football club, play live 1v1 matches against real managers, and trade player shares on a market that moves because of what happened on the pitch.",
};

/**
 * Landing page — docs/05-landing-page.md.
 *
 * The page's single job is to convince a football-and-numbers person that this
 * is a real live game within the first screen, so the hero leads with a running
 * match rather than a headline over a gradient.
 *
 * Deliberately absent, per the spec: stock stadium photography, animated
 * gradients, scroll-triggered fade-ins on every section, and 01/02/03 markers
 * on the three pillars (that isn't a real sequence — the one further down is).
 */
export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-24 px-6 py-12 sm:py-16">
      <header className="flex items-center justify-between">
        <span className="eyebrow text-floodlight">Empire Live</span>
        <nav className="flex items-center gap-6 font-sans text-sm">
          <a
            href="#how-it-works"
            className="hidden text-floodlight/55 underline-offset-4 hover:text-signal hover:underline sm:inline"
          >
            How it works
          </a>
          <a
            href="/sign-in"
            className="text-floodlight/55 underline-offset-4 hover:text-signal hover:underline"
          >
            Sign in
          </a>
        </nav>
      </header>

      <main className="flex flex-col gap-24">
        {/* Hero — the match card comes first; the words come second. */}
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          <HeroMatchCard />

          <div className="flex flex-col gap-7">
            <h1 className="display-xl text-floodlight">
              Real matches. Real managers. A market that moves because they
              happened.
            </h1>

            <p className="max-w-md font-sans text-base leading-relaxed text-floodlight/60">
              Two managers, the same ninety minutes, decisions that land while
              the ball is still moving. Every pass, shot and card is recorded —
              and every price on the Bourse moves off that record.
            </p>

            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/sign-up">Start managing</ButtonLink>
              <ButtonLink href="/bootstrap" variant="secondary">
                Watch a live match
              </ButtonLink>
            </div>
          </div>
        </section>

        <Pillars />

        <div id="how-it-works" className="scroll-mt-12">
          <HowItWorks />
        </div>

        {/* Closing CTA — restrained by design. No second hero, no countdown. */}
        <section className="flex flex-col items-start gap-6">
          <h2 className="display-lg max-w-2xl text-floodlight">
            Take a club. Play the next match.
          </h2>
          <p className="max-w-md font-sans text-base leading-relaxed text-floodlight/60">
            Free to start. Your first match can be tonight.
          </p>
          <ButtonLink href="/sign-up">Start managing</ButtonLink>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
