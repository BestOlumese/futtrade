# Live Match Viewer

Built on `04-design-system.md`. This is the single most important screen in the product — the thing the whole game is built to deliver. It needs to feel like tuning into a broadcast, not opening an app.

## Layered views (see `03-features.md` for the underlying event-stream spec)

Three depths, one toggle, same event stream underneath:

1. **Default — Stat ticker view.** Running xG chart (recharts, `signal`/`tally` split by team), live event ticker below it (`IBM Plex Mono` timestamps, `IBM Plex Sans` event text), scoreline and clock always visible at the top regardless of which view is active.
2. **2D dot replay.** Phaser 3 canvas, 11 dots per side positioned per tick, client-interpolated between server ticks (see `02-concerns.md` — never extrapolate ahead of confirmed state). Finesse-tagged shots render as a curved dotted trajectory line to goal; power shots as straight lines — this is the visual-flair rule from the features spec, no full physics animation needed.
3. **Full heatmap/timeline.** Reserved for flagged matches (derbies, finals, the user's own live matches) per the phased build order — post-match aggregate touch heatmap plus the full timestamped event log, not shown by default during a routine match to keep the interface calm on lower-stakes fixtures.

The toggle between these three is a persistent, low-key control (small tab group, `steel`-bordered, `signal` active state) — never a modal, never interrupts the live feed while switching.

## Top bar — the scoreboard

Always visible regardless of which of the three views is active. This is the broadcast lower-third made literal:
- Both club marks, scoreline, running clock — all `IBM Plex Mono`, tabular
- The `tally` dot pulsing next to "LIVE"
- A compact form-guide strip (last 5 results as small marks) is deliberately **not** here — this bar's only job is the current match, nothing else competes for space in it

## Manager controls — the tactics panel

A collapsible side panel (desktop) / bottom sheet (mobile), only visible to the two managing users, not spectators/traders watching the same match:
- Two tactical dials in Phase 0/1 (mentality, pressing), expanding to formation + full range in Phase 4 — rendered as physical-feeling sliders/dial controls, not dropdown menus, since these are the game's core live-decision moments and deserve tactile-feeling controls
- Substitution queue: tapping a bench player queues them with a visible countdown matching the server-enforced delay (10-15s) — the countdown is not decorative, it's showing the player the actual server-side timer from `02-concerns.md`, so the UI never claims a sub is "in" before the server confirms it
- Remaining action counters (subs left, tactical changes left this half) always visible near the controls — server-truth counts, not client-estimated

## Spectator/trader view

Same top bar and stat/replay views, no tactics panel. Instead, a live price ticker for players in the match sits where the tactics panel would be for a manager — this is the trader's version of the same screen, reusing layout rather than being a separate design.

## Momentum graph

A thin horizontal bar beneath the scoreboard, `signal`/`tally` split by team, updating per tick window — directly answers "who's on top right now" without reading the stat ticker in detail. This is a glance-level element, intentionally small.

## Disconnection/reconnection state

Per `02-concerns.md`, this needs a real, decided UI state — not a spinner that could mean anything. Show "Reconnecting…" with the last-known score frozen and clearly marked as last-known, not silently continuing to animate.

## What this surface deliberately does NOT do

- No fake "crowd noise visualizer" or decorative stadium-atmosphere graphics competing with real data
- No modal interruptions for tactical changes — everything happens in the persistent side panel/sheet so the live feed is never covered
- No chamfered-panel treatment on the scoreboard bar itself — it's a full-width broadcast bar, not a card, and shouldn't be treated like one
