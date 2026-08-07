# Phase 21 — Scouting Fog

**Depends on:** 09
**Complexity:** M

## Goal
Information asymmetry that makes the market and squad-building genuinely interesting.

## Tasks
- [ ] Fogged attribute range calculation (e.g. Finishing 68-79) as a function of scout time/budget invested
- [ ] Scouting UI: invest time, watch the range narrow toward true CA-derived attributes
- [ ] Server enforcement that true CA/attributes never transmit to a client that hasn't earned the reveal (see `docs/concerns/01-fairness-anticheat.md`)

## Explicitly out of scope
- Rumor-market interaction with scouting (Phase 23)

## Exit criteria
Two test scouts investing different amounts of time on the same player see measurably different range widths, and the true value never appears in client network traffic before it's earned.
