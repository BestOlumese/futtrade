# Feature: 2D Match Viewer

**Phases:** 05, 06, 22

## Spec

- Default view: xG/stat cards, event ticker
- Drill-in: 2D dot replay (Phaser 3), client-side interpolated between tick snapshots
- Flagged matches (derbies, finals, the user's own live matches): full heatmap + timeline
- Live version renders the same event stream in real time as it streams from the Colyseus room, rather than post-match replay

## Acceptance

Dot movement never visibly teleports between ticks; a finesse-tagged shot renders visually distinct from a power shot (curved vs. straight trajectory line) without full physics animation.

## Related

Full surface design: `docs/08-live-match-viewer.md`. Performance profiling requirements: `docs/concerns/08-mobile-performance.md`.
