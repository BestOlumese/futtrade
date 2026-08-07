# Phase 20 — Injuries

**Depends on:** 14, 19
**Complexity:** M

## Goal
Real stakes to squad rotation and match risk.

## Tasks
- [ ] Injury trigger logic (tied to match events/minutes, severity tiers)
- [ ] Temporary attribute debuff scaled to severity, with a recovery-window UI
- [ ] Severe injuries: small defined probability of a permanent potential-ceiling reduction, logged to `player_development_log`

## Explicitly out of scope
- Injury-prone personality sub-traits (possible future depth, not required here)

## Exit criteria
An injured player's attributes are visibly reduced for the recovery window and correctly return to baseline after, with any permanent ceiling change properly logged.
