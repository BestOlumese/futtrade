# Phase 14 — Form Calculation & Decay

**Depends on:** 04, 13
**Complexity:** M

## Goal
Short-term match performance affects a player's near-term output, separate from long-term development.

## Tasks
- [ ] `match_performance_log`: per-player-per-match rating derived from `match_events`
- [ ] Form field, nudged by rating vs. position-appropriate expectation
- [ ] Decay job (Inngest): Form trends back to zero over ~2-3 weeks if untouched
- [ ] Rust/sharpness penalty for players unused beyond a defined day threshold

## Explicitly out of scope
- Rare permanent CA nudges from sustained streaks (deferred to Phase 15 if not completed here)

## Exit criteria
A player's Form visibly rises after a strong logged performance and decays back toward zero over the following weeks if they don't play again.
