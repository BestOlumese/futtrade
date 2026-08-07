# Concern: Mobile & Rendering Performance

**Applies to phases:** 06, 22

## Profile on real devices, not just desktop Chrome

The live 2D dot viewer runs on Phaser inside a mobile browser context. Profile tick-interpolation rendering on mid-range Android hardware specifically before assuming the live-match experience works on the devices the actual playerbase uses — desktop Chrome performance numbers are not representative and will hide real problems.

## What to watch for

- Frame drops during interpolation between ticks, especially with 22 dots on screen plus event overlays
- Battery/thermal behavior over a full 90-simulated-minute live session, not just a short test clip
- WebSocket reconnection behavior specifically on mobile networks (switching between wifi/cellular mid-match), which is a much more common real-world scenario on mobile than desktop

## Flagged-match heatmap cost (Phase 22)

The full heatmap/timeline treatment is intentionally reserved for flagged matches only, not computed for every routine match — this is a performance decision as much as a design one. Confirm this restriction actually holds in the implementation (i.e. the aggregation work genuinely isn't running for non-flagged matches), not just that the UI hides it.
