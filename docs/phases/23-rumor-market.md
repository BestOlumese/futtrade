# Phase 23 — Rumor Market

**Depends on:** 17, 21
**Complexity:** M

## Goal
A speculative pre-match layer that rewards attention without breaking the "information becomes public at kickoff" rule from `docs/concerns/05-market-integrity.md`.

## Tasks
- [ ] Pre-match rumor feed (team news, injury leaks) on a defined, server-enforced timing window
- [ ] Visually distinct "unconfirmed" ticker strip (dashed border, per `docs/09-market.md`) separate from settled price data
- [ ] Explicit server-side gate: confirmed lineup/tactics never reach the public feed before kickoff

## Explicitly out of scope
- User-submitted rumors — this is a system-generated speculative layer only, not UGC, for v1

## Exit criteria
No confirmed manager-only information appears in the public rumor feed before kickoff, in any tested scenario.
