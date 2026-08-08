"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/panel";
import { ClubMark } from "./club-mark";

/**
 * The hero doesn't describe the product — it is the product, running.
 *
 * This is the page's single orchestrated motion moment: on load the clock and
 * ticker start moving, as if you've tuned into a broadcast already in progress.
 * Everything else on the page is static, per the motion budget in
 * docs/04-design-system.md.
 *
 * Under `prefers-reduced-motion` it freezes on the first frame and keeps the
 * LIVE badge, rather than degrading to something that no longer reads as live.
 *
 * All of this is fictional demo data. It is deliberately not wired to a real
 * match — the landing page must work for a first-time visitor when no match
 * happens to be in progress.
 */

const KICKOFF_SECOND = 64 * 60 + 12;

const TICKER_EVENTS = [
  { minute: "64'", text: "Yellow card, Adeyemi" },
  { minute: "66'", text: "Shot saved, Okonkwo (xG 0.31)" },
  { minute: "68'", text: "Substitution, Bello on for Traoré" },
  { minute: "71'", text: "Goal, Adeyemi (xG 0.44)" },
  { minute: "73'", text: "Tackle won, Mensah" },
];

const PRICE_STEPS = [
  { price: 4.82, delta: 0.06 },
  { price: 4.9, delta: 0.08 },
  { price: 4.87, delta: -0.03 },
  { price: 5.14, delta: 0.27 },
  { price: 5.19, delta: 0.05 },
];

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function HeroMatchCard() {
  // Deterministic first frame so server and client markup agree; the timers
  // only start after mount.
  const [seconds, setSeconds] = useState(KICKOFF_SECOND);
  const [step, setStep] = useState(0);
  const [homeScore, setHomeScore] = useState(1);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const clock = setInterval(() => setSeconds((s) => s + 1), 1000);
    const feed = setInterval(() => {
      setStep((current) => {
        const next = (current + 1) % TICKER_EVENTS.length;
        // The goal in the feed moves the scoreline, so the card stays coherent
        // rather than showing events that contradict the score.
        setHomeScore(next >= 3 ? 2 : 1);
        return next;
      });
    }, 3800);

    return () => {
      clearInterval(clock);
      clearInterval(feed);
    };
  }, []);

  const event = TICKER_EVENTS[step];
  const tick = PRICE_STEPS[step];
  const rising = tick.delta >= 0;

  return (
    <div className="flex flex-col gap-4">
      <Panel live>
        <div className="flex flex-col gap-6 p-6 sm:p-7">
          {/* Liveness is stated in words as well as color — the dot never
              carries the meaning alone. */}
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <span className="tally-dot" />
              <span className="eyebrow text-tally">Live</span>
            </span>
            <span className="numeric text-sm text-floodlight/60">
              {formatClock(seconds)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <ClubMark variant="home" className="h-9 w-9 shrink-0" />
              <span className="truncate font-sans text-sm font-medium text-floodlight">
                Lagos Vanguard
              </span>
            </div>

            <div className="numeric shrink-0 text-4xl leading-none font-semibold text-floodlight">
              {homeScore}–1
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
              <span className="truncate text-right font-sans text-sm font-medium text-floodlight">
                Ikorodu FC
              </span>
              <ClubMark variant="away" className="h-9 w-9 shrink-0" />
            </div>
          </div>

          {/* Event ticker */}
          <div
            className="flex items-center gap-3 border-t border-steel/30 pt-4"
            aria-live="polite"
          >
            <span className="numeric shrink-0 text-xs text-signal">
              {event.minute}
            </span>
            <span className="truncate font-sans text-sm text-floodlight/75">
              {event.text}
            </span>
          </div>
        </div>
      </Panel>

      {/* The market side of the same moment: one player's price, moving
          because of the events above. */}
      <Panel>
        <div className="flex items-center justify-between gap-4 p-5">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="eyebrow text-floodlight/45">Bourse</span>
            <span className="truncate font-sans text-sm font-medium text-floodlight">
              K. Adeyemi
            </span>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="numeric text-xl leading-none font-semibold text-floodlight">
              £{tick.price.toFixed(2)}
            </span>
            {/* Sign and arrow glyph alongside the color, never color alone. */}
            <span
              className={`numeric text-xs ${rising ? "text-signal" : "text-tally"}`}
            >
              {rising ? "▲ +" : "▼ −"}
              {Math.abs(tick.delta).toFixed(2)}
            </span>
          </div>
        </div>
      </Panel>
    </div>
  );
}
