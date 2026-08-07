# Phase 06 — Live 2D Dot Replay

**Depends on:** 03, 05
**Complexity:** L

## Goal
The signature live-viewing experience — watching dots move on a pitch in real time, driven by the authoritative tick stream. See `docs/08-live-match-viewer.md` for the full surface design.

## Tasks
- [ ] Phaser 3 canvas embedded in Next.js, connects to the match's Colyseus room
- [ ] Server includes per-player x/y in the tick broadcast
- [ ] Client-side interpolation between ticks (never extrapolate ahead of confirmed state, per `docs/concerns/02-realtime-sync-reconnection.md`)
- [ ] Finesse vs. power shot visual distinction (curved dotted line vs. straight line) at the moment of a shot event

## Explicitly out of scope
- Full heatmap/timeline treatment (Phase 22, flagged matches only)
- Momentum graph (bundled with later UI polish)

## Exit criteria
Dot movement is smooth with no visible teleporting across a full live match, verified on both desktop and a mid-range mobile device.
