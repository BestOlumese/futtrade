# Phase 10 — Squad Fielding Integration

**Depends on:** 06, 09
**Complexity:** M

## Goal
Real database-backed players, not flat test ratings, are what actually plays in a live match.

## Tasks
- [ ] Starting XI selection UI, respecting formation slots
- [ ] Sim reads real per-player attributes instead of the flat placeholder rating from Phase 02
- [ ] Confirm attribute differences (e.g. a high-Pace winger) visibly change match-engine behavior

## Explicitly out of scope
- Substitutions (Phase 11)
- Playstyles affecting sim (Phase 18)

## Exit criteria
Swapping a single player for a meaningfully different one (e.g. much higher Finishing) produces a measurable shift in that player's shot/goal output over repeated simulated matches.
