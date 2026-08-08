"use client";

import { useEffect, useRef, useState } from "react";
import { LOOP_MS } from "./timeline";

/**
 * One shared clock for the whole page.
 *
 * A single requestAnimationFrame driver, not one interval per widget. Because
 * every consumer derives its state from the same elapsed time, all the animated
 * surfaces stay in sync by construction rather than by luck — the hero's clock
 * can never disagree with the match center's.
 *
 * Three power behaviours, all required by docs/concerns/08-mobile-performance.md:
 *   - a section that scrolls out of view unsubscribes and stops re-rendering
 *   - the driver stops entirely when no one is subscribed, or the tab is hidden
 *   - `prefers-reduced-motion` freezes time at 0 and never starts the loop
 *
 * Time is measured against wall clock rather than accumulated per frame, so a
 * section scrolled back into view resumes in sync instead of restarting, and
 * the paused interval doesn't shift the loop.
 */

/** State updates per second. Low on purpose — consumers use CSS transitions to
 *  interpolate between ticks, which is smooth and far cheaper than animating in
 *  JavaScript, and matches how the real viewer will treat server ticks. */
const TICK_HZ = 8;
const TICK_MS = 1000 / TICK_HZ;

type Listener = (t: number) => void;

const listeners = new Set<Listener>();
let rafId = 0;
let startedAt = 0;
let lastEmit = 0;
let pausedFor = 0;
let pausedAt = 0;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function frame(now: number) {
  if (now - lastEmit >= TICK_MS) {
    lastEmit = now;
    const t = (now - startedAt - pausedFor) % LOOP_MS;
    for (const listener of listeners) listener(t);
  }
  rafId = requestAnimationFrame(frame);
}

function start() {
  if (rafId || prefersReducedMotion()) return;
  const now = performance.now();
  if (!startedAt) startedAt = now;
  // Don't let a hidden tab or an unobserved stretch advance the loop.
  if (pausedAt) {
    pausedFor += now - pausedAt;
    pausedAt = 0;
  }
  lastEmit = 0;
  rafId = requestAnimationFrame(frame);
}

function stop() {
  if (!rafId) return;
  cancelAnimationFrame(rafId);
  rafId = 0;
  pausedAt = performance.now();
}

function sync() {
  const shouldRun =
    listeners.size > 0 &&
    typeof document !== "undefined" &&
    document.visibilityState === "visible";
  if (shouldRun) start();
  else stop();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  sync();
  return () => {
    listeners.delete(listener);
    sync();
  };
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", sync);
}

/**
 * Returns the current loop time in ms, and a ref to attach to the section that
 * owns the animation. The animation only runs while that element is on screen.
 *
 * Starts at 0 on both server and client, so the first paint matches and there
 * is no hydration mismatch.
 */
export function useDemoClock<T extends HTMLElement = HTMLDivElement>() {
  const [t, setT] = useState(0);
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion()) return;

    let unsubscribe: (() => void) | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !unsubscribe) {
          unsubscribe = subscribe(setT);
        } else if (!entry.isIntersecting && unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
      },
      // A little margin so motion is already running by the time it's read.
      { rootMargin: "120px" },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      unsubscribe?.();
    };
  }, []);

  return { t, ref };
}
