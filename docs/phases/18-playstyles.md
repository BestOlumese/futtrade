# Phase 18 — Playstyles

**Depends on:** 10, 12
**Complexity:** L

## Goal
Two same-CA players feel mechanically different, not just numerically different.

## Tasks
- [ ] `player_playstyles` join table, Regular/+ tier enum
- [ ] Define mechanical weight-shift per playstyle in the sim (e.g. Finesse Shot shifts power weighting toward curve/placement)
- [ ] Tier progression: Regular → + through logged match minutes (ties into `player_development_log`)

## Explicitly out of scope
- Playstyle UI badges/marketing polish — functional weight-shift first, presentation later

## Exit criteria
Two players with identical CA but different playstyles produce measurably different outcomes (e.g. shot placement distribution) over repeated simulated matches.
