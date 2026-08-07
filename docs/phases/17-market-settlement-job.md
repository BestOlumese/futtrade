# Phase 17 — Market Settlement Job

**Depends on:** 15, 16
**Complexity:** L

## Goal
Prices move for real reasons — the payoff of the whole development system. See `docs/concerns/05-market-integrity.md` before building this.

## Tasks
- [ ] Inngest settlement job triggered after `player_development_log` / `match_performance_log` writes
- [ ] Price-movement formula: CA change = slow/structural, Form change = fast/volatile (no independent random noise)
- [ ] "Settling" UI state (tally dot, per `docs/09-market.md`) during the settlement window

## Explicitly out of scope
- Dividends, rumor market — later depth phases (23, 24)

## Exit criteria
Every price movement in the settlement log has a corresponding, pointable entry in `player_development_log` or `match_performance_log` — verified with no unexplained deltas across a test period.
