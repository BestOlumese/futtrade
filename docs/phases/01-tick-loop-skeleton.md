# Phase 01 — Tick Loop Skeleton

**Depends on:** 00
**Complexity:** M

## Goal
Prove the tick-based authoritative loop itself works — no football logic yet, just prove two clients can connect to one room and see synchronized ticked state.

## Tasks
- [ ] Define a minimal Colyseus `Schema`: tick counter, two connected player slots
- [ ] Server loop increments the tick every ~3-5s and broadcasts state
- [ ] Client displays a live tick counter, confirm both clients see identical values
- [ ] Handle basic reconnection: client disconnects and rejoins mid-room, resyncs to current tick

## Explicitly out of scope
- Any match simulation
- Any tactical input
- Any player/team data

## Exit criteria
Two separate browser sessions see the exact same tick counter incrementing in sync, with disconnect/rejoin recovering cleanly.
