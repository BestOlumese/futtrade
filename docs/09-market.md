# Market — Global Bourse

Built on `04-design-system.md`. This is the screen where the "trading terminal" half of the identity gets to lead — more data-dense than the rest of the app is allowed to be, deliberately.

## Layout

Three-column on desktop, tabbed on mobile:

1. **Watchlist/search** (left) — compact rows, player name, current price, delta (`signal` up / `tally` down, always paired with a +/- glyph, never color alone per the accessibility rule)
2. **Chart + player detail** (center, largest) — candlestick-style price chart (recharts) over the selected range, `IBM Plex Mono` axis labels, tabular. Beneath the chart: a short annotated timeline pulling directly from `player_development_log` and `match_performance_log` — every notable price move on the chart has a matching label ("Hat-trick vs. Ikorodu FC" marker at the exact point on the chart), so the chart never shows unexplained movement, matching the acceptance criterion in `03-features.md`.
3. **Order/portfolio panel** (right) — buy/sell controls, current holdings, a chamfered panel distinct from the chart area (`pitch-shadow` background, `signal` edge-line)

## The "why did this move" annotation

This is the signature interaction of the screen, not a nice-to-have: every meaningful price point on the chart is clickable/hoverable and surfaces the exact logged event that caused it. This is what separates the Bourse from a generic stock-chart UI — the market is legibly connected to real matches, not abstract.

## Live settlement state

During an active settlement window (right after a match ends, per `02-concerns.md`'s data-consistency note), affected players' rows show a small `tally` dot labeled "Settling" rather than silently showing a stale price — this reuses the tally-dot pattern but is a distinct, explicitly labeled state so it's never confused with "this match is live."

## Rumor market (Phase 7)

A separate, clearly labeled ticker strip above the watchlist — visually distinct (dashed `steel` border, not a solid chamfered panel) to signal "unconfirmed" versus the settled, confirmed data everywhere else on the screen. This distinction matters: rumor-market information should never look as authoritative as settled price data.

## Trader vs. manager view

Identical screen for both roles — the Bourse doesn't change based on whether the viewer manages a club, which is deliberate: it's the one surface in the product where managers and traders are on equal footing, reinforcing the two-sided-economy design from the features spec.

## What this surface deliberately does NOT do

- No countdown timers or "act now" urgency styling on buy/sell controls — the `tally` accent is reserved for genuine liveness/urgency per the design system, not sales pressure
- No decorative sparkline "mini-charts" scattered around the page beyond the watchlist rows — chart real estate goes to the one main chart, not many small competing ones
- No portfolio "gamification" badges or streaks — this screen's credibility depends on feeling like real market data, not a rewards system
