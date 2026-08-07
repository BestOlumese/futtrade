# Concern: Data Consistency (Event Stream → Form → Market)

**Applies to phases:** 04, 14, 15, 17

## The pipeline

`match_events` → `match_performance_log` → Form/CA updates (`player_development_log`) → market settlement. Every stage downstream depends on the one before it being complete and correct.

## The async gap

If this pipeline runs async (an Inngest job reacting to match completion, as designed), there's a window between match end and Form/price settlement being final. **Define what a user sees in that gap explicitly** — an honest "Settling" state (as specified in the market design doc) beats a silently stale number that looks final but isn't.

## Traceability is not optional

CA/Form/price changes should always be traceable back to a specific match or training cycle. `player_development_log` exists specifically so no system can mutate CA or Form without leaving a record. This isn't just a nice debugging aid — it's the foundation of the "why did this price move" feature that's central to what makes the market feel legitimate rather than arbitrary. Any code path that changes CA or Form without writing to this log is a bug, not a shortcut.

## Idempotency

The settlement job may be retried (Inngest's normal retry behavior) — make sure re-running settlement for an already-settled match doesn't double-apply a price change. Key settlement operations off the match/event ID, not off "run once and hope."
