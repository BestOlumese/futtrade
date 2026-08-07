# Phase 07 — Matchmaking Queue

**Depends on:** 03
**Complexity:** M

## Goal
Two real accounts can find each other automatically instead of manually joining a room by ID.

## Tasks
- [ ] Queue table/state: rating, timestamp joined
- [ ] Widening curve: ±50 initial, +25 every 10s, cap ±300
- [ ] On pair found: create a Colyseus room, issue both clients a join token

## Explicitly out of scope
- AI-ghost fallback (Phase 08)
- Division/league structure

## Exit criteria
Two accounts of similar rating are reliably paired within one widening step under test conditions.
