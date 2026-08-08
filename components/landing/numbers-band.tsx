"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Section 7 — the numbers band.
 *
 * The only place on the page where mono type goes large. Figures count up once,
 * the first time they scroll into view, then hold — deliberately not a
 * perpetual ticker. The motion budget is already spent on the match card, the
 * ball and the live candle, and a fourth thing moving forever would compete
 * with all three.
 *
 * Values are placeholders until real ones exist.
 */

const FIGURES = [
  { value: 18400, suffix: "", label: "Players tracked", format: "comma" },
  { value: 1200, suffix: "+", label: "Events per match", format: "comma" },
  { value: 90, suffix: "", label: "Minutes, live", format: "plain" },
  { value: 24, suffix: "/7", label: "Market open", format: "plain" },
] as const;

const DURATION_MS = 900;

function useCountUp(target: number, active: boolean): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;

    // Reduced motion uses a zero-length roll-up, which lands on the final value
    // on the first frame. Same code path, no animation.
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : DURATION_MS;

    let frame = 0;
    const started = performance.now();

    const step = (now: number) => {
      const progress =
        duration === 0 ? 1 : Math.min((now - started) / duration, 1);
      // Ease out, so it decelerates into the final value rather than stopping dead.
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, active]);

  return value;
}

function Figure({
  figure,
  active,
}: {
  figure: (typeof FIGURES)[number];
  active: boolean;
}) {
  const raw = useCountUp(figure.value, active);
  const rounded = Math.round(raw);
  const shown =
    figure.format === "comma" ? rounded.toLocaleString("en-GB") : String(rounded);

  return (
    <div className="flex flex-col gap-2 bg-midnight px-6 py-8">
      <span className="numeric text-3xl leading-none text-lime">
        {shown}
        {figure.suffix}
      </span>
      <span className="label text-mute">{figure.label}</span>
    </div>
  );
}

export function NumbersBand() {
  const ref = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // The observer runs regardless of motion preference — it decides *when* to
    // show the values, not whether to animate them. useCountUp handles that.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.disconnect(); // once only
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="grid gap-px border-y border-steel/25 bg-steel/20 sm:grid-cols-2 lg:grid-cols-4"
    >
      {FIGURES.map((figure) => (
        <Figure key={figure.label} figure={figure} active={active} />
      ))}
    </section>
  );
}
