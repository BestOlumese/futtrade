import type { Metadata } from "next";
import { Atmosphere, Glow } from "@/components/atmosphere/atmosphere";
import { SiteHeader } from "@/components/landing/site-header";
import { Hero } from "@/components/landing/hero";
import { MatchCenter } from "@/components/landing/match-center";
import { TacticsAndDevelopment } from "@/components/landing/tactics-development";
import { Bourse } from "@/components/landing/bourse";
import { HowItWorks } from "@/components/landing/how-it-works";
import { NumbersBand } from "@/components/landing/numbers-band";
import { SiteFooter } from "@/components/landing/site-footer";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "FUTTRADE — real matches, real managers, a market that moves",
  description:
    "Manage a football club, play live 1v1 matches against real managers, and trade player shares on a market that moves because of what happened on the pitch.",
};

/**
 * Landing page — docs/05-landing-page.md.
 *
 * A brand surface: full atmosphere stack, long cinematic scroll. The hero
 * doesn't describe the product, it runs it.
 */
export default function Home() {
  return (
    <>
      <Atmosphere variant="full" />

      <div className="mx-auto max-w-7xl px-6">
        <SiteHeader />

        <main className="flex flex-col gap-28 pb-28 sm:gap-36">
          <Hero />
          <MatchCenter />
          <TacticsAndDevelopment />
          <Bourse />
          <HowItWorks />
          <NumbersBand />

          {/* Closing CTA — restrained. One glow, one repeat of the primary
              action, no second hero and no urgency gimmick. */}
          <section className="relative flex flex-col items-start gap-7 py-10">
            <Glow className="-bottom-32 left-[20%] h-96 w-136" />

            <div className="relative flex flex-col items-start gap-7">
              <h2 className="display-xl max-w-[18ch] text-floodlight">
                Take a club. Play the next match.
              </h2>
              <p className="max-w-md font-sans text-base leading-relaxed text-floodlight/55">
                Free to start. Your first match can be tonight.
              </p>
              <ButtonLink href="/sign-up">Start managing</ButtonLink>
            </div>
          </section>
        </main>

        <SiteFooter />
        <div className="h-10" />
      </div>
    </>
  );
}
