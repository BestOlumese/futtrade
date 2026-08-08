"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/panel";
import { LiveBadge } from "@/components/ui/live-badge";
import { ClubMark } from "./club-mark";

/**
 * The hero's set piece: a match that is visibly running.
 *
 * All fictional demo data, deliberately not wired to a real match — the landing
 * page has to work for a first-time visitor when nothing happens to be live.
 *
 * Under `prefers-reduced-motion` the timers never start, so it holds a coherent
 * frame and keeps the LIVE badge. A reduced-motion user must still be able to
 * tell what this is.
 */

const START_SECOND = 64 * 60 + 12;

const FEED = [
  { minute: "64'", text: "Yellow card · Adeyemi", tone: "live" as const },
  { minute: "66'", text: "Shot saved · xG 0.31", tone: "muted" as const },
  { minute: "68'", text: "Sub · Bello for Traoré", tone: "muted" as const },
  { minute: "71'", text: "Goal · Adeyemi · xG 0.44", tone: "lime" as const },
  { minute: "73'", text: "Tackle won · Mensah", tone: "muted" as const },
];

const PRICES = [4.82, 4.9, 4.87, 5.14, 5.19];

function clock(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function LiveMatchCard() {
  const [seconds, setSeconds] = useState(START_SECOND);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    const feed = setInterval(() => setStep((s) => (s + 1) % FEED.length), 3600);
    return () => {
      clearInterval(tick);
      clearInterval(feed);
    };
  }, []);

  const homeScore = step >= 3 ? 2 : 1;
  const price = PRICES[step];
  const delta = price - PRICES[step === 0 ? PRICES.length - 1 : step - 1];
  const rising = delta >= 0;

  // Newest event first, so the feed reads like a broadcast ticker.
  const visible = Array.from({ length: 3 }, (_, i) => FEED[(step - i + FEED.length) % FEED.length]);

  return (
    <Panel live brackets bodyClassName="p-6 sm:p-7">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <LiveBadge />
          <span className="numeric text-sm text-floodlight/70">
            {clock(seconds)}
          </span>
        </div>

        {/* Scoreline */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <ClubMark variant="home" className="h-8 w-8" />
            <span className="truncate font-sans text-xs font-medium text-floodlight">
              Lagos Vanguard
            </span>
          </div>

          <div className="numeric shrink-0 text-5xl leading-none font-medium text-floodlight">
            {homeScore}
            <span className="px-1 text-mute">:</span>1
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-end gap-2">
            <ClubMark variant="away" className="h-8 w-8" />
            <span className="truncate font-sans text-xs font-medium text-floodlight">
              Ikorodu FC
            </span>
          </div>
        </div>

        {/* Possession */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="numeric text-xs text-lime">62%</span>
            <span className="label text-mute">Possession</span>
            <span className="numeric text-xs text-floodlight/50">38%</span>
          </div>
          <div className="flex h-1 gap-px" aria-hidden="true">
            <span className="bg-lime" style={{ width: "62%" }} />
            <span className="flex-1 bg-steel/50" />
          </div>
        </div>

        {/* Event feed */}
        <div
          className="flex flex-col gap-2 border-t border-steel/25 pt-4"
          aria-live="polite"
        >
          {visible.map((event, i) => (
            <div
              key={`${event.minute}-${i}`}
              className="flex items-center gap-3 transition-opacity duration-instant"
              style={{ opacity: 1 - i * 0.38 }}
            >
              <span className="numeric w-8 shrink-0 text-xs text-mute">
                {event.minute}
              </span>
              <span
                className={`truncate font-sans text-xs ${
                  event.tone === "lime"
                    ? "text-lime"
                    : event.tone === "live"
                      ? "text-live"
                      : "text-floodlight/65"
                }`}
              >
                {event.text}
              </span>
            </div>
          ))}
        </div>

        {/* The market side of the same moment */}
        <div className="flex items-center justify-between border-t border-steel/25 pt-4">
          <div className="flex flex-col gap-1">
            <span className="label text-mute">Bourse · Adeyemi</span>
            <span className="numeric text-lg leading-none text-floodlight">
              £{price.toFixed(2)}
            </span>
          </div>
          {/* Sign and arrow glyph alongside the color, never color alone. */}
          <span
            className={`numeric text-sm ${rising ? "text-lime" : "text-live"}`}
          >
            {rising ? "▲" : "▼"} {rising ? "+" : "−"}
            {Math.abs(delta).toFixed(2)}
          </span>
        </div>
      </div>
    </Panel>
  );
}
