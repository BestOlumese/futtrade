# Phase 08 — AI-Ghost Fallback

**Depends on:** 07
**Complexity:** M

## Goal
Nobody is left waiting indefinitely, especially across the timezone gaps flagged in `docs/concerns/03-matchmaking-latency-timezone.md`.

## Tasks
- [ ] Store a club's "last-used tactics" snapshot for ghost reuse
- [ ] Timeout trigger (default 45s) spins up a match against a ghost using saved tactics, run entirely server-side
- [ ] Client UI clearly labels a ghost match as such — never presented as if it were a live opponent

## Explicitly out of scope
- Ghost difficulty tuning/rating (use the source club's own rating for v1, revisit later)

## Exit criteria
A solo test account reliably gets matched to a ghost after the timeout, clearly labeled, with a normal-feeling match experience.
