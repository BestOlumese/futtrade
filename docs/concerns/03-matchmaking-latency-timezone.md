# Concern: Matchmaking Latency & Timezone Fairness

**Applies to phases:** 07, 08

## The core problem

A Lagos-based playerbase means peak-hour overlap with other regions won't always exist. Since matches are live-only (both managers online simultaneously), this is a structural risk to the whole product, not a minor UX rough edge.

## Why the AI-ghost fallback isn't optional polish

Without a fallback, off-peak users simply can't play at all — that's a retention risk baked into the core loop, not a nice-to-have feature. Phase 08 should be treated with the same priority as the matchmaking queue itself, not deferred as a "later" feature.

## Queue-widening curve

Decide the curve explicitly rather than picking arbitrary numbers per feature — the current default (±50 initial, +25 every 10s, cap ±300) should be treated as a starting hypothesis to tune against real queue-time data once there's a real playerbase, not a fixed constant to leave unexamined.

## What to watch post-launch

Track queue-time distribution by hour-of-day and region once there's real traffic. If a meaningful fraction of Lagos-peak-hour users are consistently falling through to AI-ghost matches, that's a signal to revisit either the widening curve or the timeout threshold, not just to accept as expected behavior.
