# Phase 04 — Event Schema & Persistence

**Depends on:** 02
**Complexity:** M
**Status:** complete, closed 2026-08-09

## Goal
Every shot/pass/tackle/card/sub the sim generates is captured in the structured event format the rest of the product depends on.

## Tasks
- [x] Define `match_events` table (Drizzle schema): type, tick, location, players, xg, outcome
- [x] Sim emits structured events at the moment they occur, not just aggregate stats
- [x] Batch-write events to Postgres (buffer per tick or per few ticks — avoid a per-event round trip)
- [x] Verify a completed match's full event log is queryable and complete

## Explicitly out of scope
- Any UI rendering of these events — that's Phase 05/06

## Exit criteria
A completed match's event log fully reconstructs the match's shots/passes/cards with no gaps, verified against the sim's internal state.

---

## What was built

The full schema and its rationale live in
[docs/features/03-event-stream.md](../features/03-event-stream.md) — that is the
document to read before touching any of this. Summary of the decisions:

| Decision | Choice |
| --- | --- |
| Pass events | **Sampled**, ~300 a match, not the ~900 a real match plays |
| Locations | **Derived from chance quality** — a 0.44 xG shot is placed near the spot |
| Player identity | **Side + shirt 1–11**, with a nullable `player_id` for Phase 10 |
| Flush cadence | **Every 5 ticks and at full time** — six batched inserts a match |
| Match row | **Opened at kickoff**, completed at full time, swept to `abandoned` |
| Live delivery | **Broadcast**, deliberately not in the replicated Colyseus state |
| Goals | **A shot with `outcome = 'goal'`**, not a separate event type |
| Aggregates on `match` | **Kept, and asserted equal to the event log** |

Two things went slightly beyond a pure schema phase, both deliberately:

- **Fouls and cards are now simulated**, because the exit criterion names cards
  and there was nothing generating them. Pressing drives fouls; a red genuinely
  costs that side. `sim:tune` was re-run and every Phase 02 target still holds.
- **`totalsFrom()`** in `server/src/sim/events.ts` derives a side's whole stat
  line from events alone. It is the design rule made into a function, and it is
  what the exit criterion is asserted against.

## How it was verified

```
npm --prefix server run events:verify [runs]   # ~6.4M assertions over 3000 matches
npm --prefix server run events:e2e             # a real match through the real room
npm --prefix server run sim:tune               # Phase 02 targets still hold
```

`events:verify` sweeps the whole dial space, rebuilds each match from its events
alone and requires the result to equal the sim's private state, checks structural
invariants (contiguous `seq`, valid taxonomy, on-pitch coordinates, xG only on
shots, every card adjacent to its foul), and round-trips one match through the
real write path into Postgres and back field by field.

`events:e2e` plays a real 90-second match through the real room and then goes
looking for it in Postgres — proving the buffer flushes, the final flush beats
the completion update, and **the live broadcast is the same log that was
stored**. It also abandons a second match to prove the row does not sit at
`status = 'live'` forever.

Two guarantees worth remembering, because they are structural rather than tested:

- `(match_id, seq)` is **uniquely indexed**, so "no gaps" is enforced by the
  database, a lost batch is one query away (`max(seq) != count(*)`), and the
  room's flush retry cannot duplicate the log.
- A match played with event collection is **bit-identical** to the same seed
  played without it, because the cosmetic draws use their own random streams.
  Without that, `sim:tune` and `events:verify` would not be looking at the same
  matches.

## Noted for later

- **A room stays joinable after full time.** `create` vs `joinOrCreate` is
  currently the client's choice, so matchmaking could drop a player into a
  finished room. It caught out the e2e harness before it could catch out a user.
  That belongs to **Phase 07 (matchmaking)**, which decides room assignment.
- **`sub` events are defined but never emitted** — substitutions need a squad,
  which is Phase 09. The type exists so Phase 10 adds a producer, not a migration.
- **The sim has no genuine tap-in.** Chance quality is drawn from a narrow band
  around 0.10, so the shot map has nothing at 0.5 xG. That is a Phase 02 property
  of the quality distribution, not of the location mapping, and it resolves when
  attributes and chance types arrive.
