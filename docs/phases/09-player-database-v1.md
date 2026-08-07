# Phase 09 — Player Database v1

**Depends on:** 00
**Complexity:** M

## Goal
Replace flat placeholder ratings with a real, structured player model — attributes and positions only, no CA/Form dynamics yet.

## Tasks
- [ ] Drizzle schema: `players`, six attribute categories with named sub-stats
- [ ] Position-weighted attribute template (striker skews Shooting/Pace, CB skews Defending/Physical, etc.)
- [ ] Seed/generate a realistic distribution of fictional players for testing
- [ ] Squad-builder UI: view a roster, see attributes per player

## Explicitly out of scope
- CA/Form (Phases 13-14)
- Playstyles, scouting fog

## Exit criteria
A full 25-30 player squad exists per test club with sensible position-appropriate attribute distributions, viewable in a basic squad UI.
