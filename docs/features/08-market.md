# Feature: Market — Global Bourse

**Phases:** 16, 17, 23, 24, 25, 26

## Spec

- Player share buy/sell, price stored in a `timescaledb` hypertable (`player_id`, `timestamp`, `price`)
- Price drivers: CA change (slow, structural) and Form change (fast, volatile) — no independent random-walk noise
- Settlement job (Inngest) runs after each match's `match_performance_log` is written
- Trader role (Phase 26): market participation without club management — same buy/sell surface, no tactics access
- Dividends (Phase 24): a portion of squad share performance feeds club finances
- Rumor market (Phase 23): pre-match team news/injury leaks create a defined speculative window, gated by the "information becomes public at kickoff" rule
- Leaderboards (Phase 25): Top Managers (win %) and Top Traders (portfolio return %)

## Acceptance

Every price movement in the settlement log has a corresponding entry in `player_development_log` or `match_performance_log` — never an unexplained delta.

## Related

`docs/concerns/05-market-integrity.md` and `docs/concerns/04-data-consistency.md` — both are load-bearing for this feature, read before building.
