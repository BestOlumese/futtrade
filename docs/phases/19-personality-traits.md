# Phase 19 — Personality Traits

**Depends on:** 13
**Complexity:** M

## Goal
Development speed varies meaningfully by player, adding a real squad-management trade-off.

## Tasks
- [ ] Personality field per player (Professional, Temperamental, Ambitious, etc.)
- [ ] Wire `personality_multiplier` into the Phase 13 CA growth formula (currently a placeholder constant)
- [ ] Ambitious trait: growth-rate penalty if minutes fall below a defined threshold — requires reading recent match-minutes history

## Explicitly out of scope
- Personality affecting Form/match-day performance directly (kept to development speed only, for scope control)

## Exit criteria
Two players with identical CA/potential but different personalities show measurably different growth trajectories under the same training focus and minutes pattern.
