# Phase 01 — Tick Loop Skeleton

**Depends on:** 00
**Complexity:** M

## Goal
Prove the tick-based authoritative loop itself works — no football logic yet, just prove two clients can connect to one room and see synchronized ticked state.

## Tasks — COMPLETE
- [x] Define a minimal Colyseus `Schema`: tick counter, two connected player slots
- [x] Server loop increments the tick every 3s and broadcasts state
- [x] Client displays a live tick counter, confirm both clients see identical values
- [x] Handle basic reconnection: client disconnects and rejoins mid-room, resyncs to current tick

Closed 2026-08-08. Verified 13/13 against a running server, plus two real
browsers:

| | |
|---|---|
| Two sessions, same room | identical tick |
| Manager drops | match keeps ticking; slot held and marked absent |
| Manager rejoins | resynced to the current tick, `joinedAtTick` unchanged — resumed, not restarted |
| Third manager | refused (room locks at two) |
| Forged / absent ticket | refused |
| Server outage | UI shows RECONNECTING…, tick frozen and marked LAST KNOWN |

### Decisions this phase locked in

- **Disconnection** — the match continues on last-known instructions with a
  60-second grace period. Recorded in `docs/concerns/02-realtime-sync-reconnection.md`,
  which required it be decided before this phase shipped.
- **Identity** — a seat requires a signed-in user. The app mints a 60-second
  signed ticket from the Better Auth session and the room verifies it with a
  shared secret (`MATCH_TICKET_SECRET`, identical in both deployments). The
  match server is on Render and the app on Vercel, so it can't read the
  httpOnly session cookie; a bearer token in localStorage would be XSS-exposed
  and querying Neon from the match server would couple the live engine to the
  database. The ticket asserts identity only — it confers no authority, and the
  room remains the single source of truth.
- **Rejoining uses Colyseus's reconnection token**, not a fresh join. The room
  locks at two managers, so a plain re-join is refused; reclaiming the held seat
  is what makes a rejoin resume rather than replace.

## Explicitly out of scope
- Any match simulation
- Any tactical input
- Any player/team data

## Exit criteria
Two separate browser sessions see the exact same tick counter incrementing in sync, with disconnect/rejoin recovering cleanly.
