# Feature: Live Match Engine

**Phases:** 01, 02, 03, 10, 11, 12

## Spec

- Colyseus room, one per match, fully authoritative
- Tick: 2-3 sim-minutes per tick, ~3-5 real seconds per tick (tune during Phase 01/02)
- Tactical dials: mentality (defensive/balanced/attacking), pressing intensity (MVP, Phase 02); formation + full mentality range (Phase 12)
- Substitution: client sends intent → server queues → 10-15s delay → applied at next tick boundary
- Action limits enforced server-side: 5 subs, 3-4 tactical changes/half
- Match state schema (Colyseus `Schema` class): score, clock, per-player position, pending-action queue, event log

## Acceptance

A match with only mentality+pressing (Phase 02) produces a plausible final score distribution over repeated simulated runs — not always 0-0, not absurd blowouts — before any richer mechanics are added.

## Related

- `docs/concerns/01-fairness-anticheat.md` — server authority is non-negotiable here
- `docs/concerns/02-realtime-sync-reconnection.md` — disconnect handling, clock authority
