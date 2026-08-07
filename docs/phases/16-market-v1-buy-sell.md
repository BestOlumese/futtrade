# Phase 16 — Market v1: Buy/Sell

**Depends on:** 00, 09
**Complexity:** L

## Goal
The Global Bourse exists as a functioning, if simple, market.

## Tasks
- [ ] `timescaledb` hypertable for price history (player_id, timestamp, price)
- [ ] Buy/sell order UI and API, basic portfolio view
- [ ] Initial price seeded from a player's current CA-derived rating (simple starting formula)

## Explicitly out of scope
- Settlement reacting to live CA/Form changes — that's Phase 17; use a static/manually-triggered price for initial testing

## Exit criteria
A user can buy and sell shares in a test player and see their portfolio update correctly, with price history queryable from the hypertable.
