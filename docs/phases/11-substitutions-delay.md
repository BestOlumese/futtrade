# Phase 11 — Substitutions with Delay

**Depends on:** 10, 03
**Complexity:** M

## Goal
The first in-match manager action beyond the two tactical dials.

## Tasks
- [ ] Bench UI, tap to queue a substitution
- [ ] Server enforces the 10-15s "getting into position" delay before the sub is live
- [ ] Countdown shown client-side matches the actual server-enforced timer, never claims early completion
- [ ] Action counter (5 subs/match) enforced server-side

## Explicitly out of scope
- Formation changes, full mentality range — Phase 12

## Exit criteria
A queued sub visibly and correctly takes effect only after the server-enforced delay, verified by watching the sim's player-on-pitch state, not just the UI countdown.
