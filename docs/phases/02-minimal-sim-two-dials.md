# Phase 02 — Minimal Sim + Two Tactical Dials

**Depends on:** 01
**Complexity:** L

## Goal
The first real gameplay — a match resolves to a plausible score, and a live tactical input visibly changes the outcome.

## Tasks
- [ ] Flat per-player rating (no attributes yet) — 11v11, both sides equal strength by default for testing
- [ ] Probability-tree sim per tick: possession, shot chance, goal chance, weighted by mentality + pressing dials
- [ ] Client UI: two dial controls (mentality, pressing), sends intent to server
- [ ] Server applies dial state to the next tick's probability weights
- [ ] Match ends at 90 simulated minutes, final score broadcast and persisted

## Explicitly out of scope
- Substitutions
- Formations beyond a fixed default
- Playstyles, attributes

## Exit criteria
Repeated simulated matches with identical starting ratings, run under different dial settings, show a measurable and sensible difference in average score/possession — not just noise.
