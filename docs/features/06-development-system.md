# Feature: Dynamic OVR / Development System

**Phases:** 13, 14, 15, 19, 20

## Spec

- Three layers: true CA (hidden), attributes (derived), Form (volatile, decays ~2-3 weeks)
- CA growth: `CA_delta = training_rate × (potential − CA) × personality_multiplier × age_multiplier` — weekly Inngest job
- Age curve: growth phase (<23) high multiplier, peak (24-29) near-flat, decline (30+) negative unless offset by traits
- Form: derived from `match_performance_log` rating vs. expectation for position/attributes, decays over ~2-3 weeks
- Rust/sharpness: temporary Form penalty for players unused beyond a defined threshold of days
- Rare CA nudge: sustained hot/cold streaks (defined threshold, e.g. N matches beyond a rating band) carry a small probability of a permanent CA shift
- Injuries (Phase 20): temporary attribute debuff scaled to severity; severe injuries carry a small permanent chance of reducing potential ceiling
- Every CA/Form mutation writes to `player_development_log` — no silent changes

## Acceptance

A player's price (once Market v1 exists) can always be explained by pointing at a specific logged CA or Form change.

## Related

`docs/concerns/04-data-consistency.md` — this feature is the source of truth the market depends on; get the logging right before building on top of it.
