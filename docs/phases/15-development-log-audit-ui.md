# Phase 15 — Development Log & Audit UI

**Depends on:** 13, 14
**Complexity:** S

## Goal
Every CA/Form change is traceable — both for debugging and as the player-facing "why did this happen" feature.

## Tasks
- [ ] `player_development_log`: every CA/Form mutation writes an entry, no silent changes anywhere in the codebase
- [ ] Squad UI surface: "+3 Finishing this month" style feed per player, pulled directly from the log
- [ ] Rare permanent CA nudge from sustained hot/cold streaks (if not completed in Phase 14), also logged here

## Explicitly out of scope
- Market-facing version of this feed (Phase 17)

## Exit criteria
For any CA or Form value in the system, there's a queryable log entry explaining why it changed and when — verified by picking a random player and tracing their full history.
