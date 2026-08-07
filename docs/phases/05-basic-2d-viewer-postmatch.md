# Phase 05 — Basic 2D Viewer (Post-Match)

**Depends on:** 04
**Complexity:** M

## Goal
Prove the event schema actually supports real UI, not just storage.

## Tasks
- [ ] Shot map component: plot events on a half-pitch, size/color by xG and outcome
- [ ] Stat card view: possession, shots, cards — all derived purely from `match_events`
- [ ] Post-match summary page combining both, no live/real-time requirement yet

## Explicitly out of scope
- Live rendering, 2D dot replay, heatmaps

## Exit criteria
Shot map and stat cards render correctly for any completed match with zero additional data path beyond `match_events`.
