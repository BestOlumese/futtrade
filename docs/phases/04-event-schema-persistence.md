# Phase 04 — Event Schema & Persistence

**Depends on:** 02
**Complexity:** M

## Goal
Every shot/pass/tackle/card/sub the sim generates is captured in the structured event format the rest of the product depends on.

## Tasks
- [ ] Define `match_events` table (Drizzle schema): type, tick, location, players, xg, outcome
- [ ] Sim emits structured events at the moment they occur, not just aggregate stats
- [ ] Batch-write events to Postgres (buffer per tick or per few ticks — avoid a per-event round trip)
- [ ] Verify a completed match's full event log is queryable and complete

## Explicitly out of scope
- Any UI rendering of these events — that's Phase 05/06

## Exit criteria
A completed match's event log fully reconstructs the match's shots/passes/cards with no gaps, verified against the sim's internal state.
