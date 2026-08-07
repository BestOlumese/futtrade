# Phase 13 — CA Growth & Training Focus

**Depends on:** 09
**Complexity:** L

## Goal
Players actually develop over time for the first time.

## Tasks
- [ ] `player_current_ability` and `player_potential_ceiling` tables (hidden, never sent to client in full)
- [ ] Weekly Inngest job applying the CA growth formula: `training_rate × (potential − CA) × age_multiplier` (personality_multiplier wired in later, Phase 19)
- [ ] Training-focus selection UI (Shooting Development, Fitness, Balanced, Position Conversion)
- [ ] Attributes table recomputes from CA whenever CA changes (derived/cached pattern)

## Explicitly out of scope
- Personality trait multipliers (Phase 19)
- Form (Phase 14)

## Exit criteria
Running the training job across several simulated weeks visibly grows a young player's CA and derived attributes with correct diminishing returns near their potential ceiling.
