"use client";

import { useEffect, useState } from "react";
import { LiveMatchCard } from "./live-match-card";
import { Glow } from "@/components/atmosphere/atmosphere";
import { ButtonLink } from "@/components/ui/button";

/**
 * Hero — the page's set piece. Full atmosphere, layered parallax, and a match
 * that is visibly running.
 *
 * Parallax is driven off scroll with the layers moving at different rates. It
 * is disabled entirely under `prefers-reduced-motion`, which freezes the scene
 * rather than degrading it.
 */
export function Hero() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setOffset(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className="relative flex min-h-[92vh] items-center pt-10 pb-24">
      <Glow className="-top-24 -right-16 h-136 w-136" />

      <div className="relative grid w-full items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
        {/* Copy moves slower than the card — the parallax rate difference is
            what creates depth. */}
        <div
          className="flex flex-col items-start gap-8"
          style={{ transform: `translateY(${offset * -0.06}px)` }}
        >
          <span className="label border border-lime/30 px-3 py-1.5 text-lime">
            Live 1v1 football management
          </span>

          <h1 className="display-hero max-w-[15ch] text-floodlight">
            Real matches.
            <br />
            Real managers.
            <br />
            <span className="text-lime">A market that moves.</span>
          </h1>

          <p className="max-w-md font-sans text-base leading-relaxed text-floodlight/60">
            Two managers, the same ninety minutes, decisions that land while the
            ball is still moving. Every pass, shot and card is recorded — and
            every price on the Bourse moves off that record.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/sign-up">Start managing</ButtonLink>
            <ButtonLink href="#match-center" variant="secondary">
              Watch a live match
            </ButtonLink>
          </div>
        </div>

        <div style={{ transform: `translateY(${offset * -0.14}px)` }}>
          <LiveMatchCard />
        </div>
      </div>
    </section>
  );
}
