# Feature: Player Database

**Phases:** 09, 10, 18, 21

## Spec

- Six attribute categories (Pace, Shooting, Passing, Dribbling, Defending, Physical), each averaged from named sub-stats
- Attributes are a **derived, cached** table — always recomputed from CA via a position-weighted template, never hand-edited directly
- Positional familiarity: off-position minutes accrue a rust penalty, decaying with more minutes played in-position
- Playstyles (Phase 18): tagged traits, Regular/+ tier, each with a defined mechanical weight-shift in the sim — no purely cosmetic playstyle
- Scouting fog (Phase 21): scouted players show a fogged range, narrowing with invested scout time/budget

## Acceptance

Two players with identical CA but different playstyles produce measurably different match-engine outcomes over repeated simulated matches.

## Related

`docs/concerns/01-fairness-anticheat.md` — hidden-value transmission rules apply directly to CA and scouting fog data.
