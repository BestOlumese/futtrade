# Phase 22 — Full Heatmap & Timeline Treatment

**Depends on:** 06
**Complexity:** M

## Goal
The "flagged match" depth experience promised in the original design.

## Tasks
- [ ] Post-match aggregate touch-heatmap component
- [ ] Full timestamped event-log view (beyond the default ticker)
- [ ] Match-flagging logic: derbies, finals, and the viewing user's own matches get this treatment by default; routine matches don't

## Explicitly out of scope
- Pre-computing this for every match regardless of flag status (keep it on-demand/flagged-only for performance)

## Exit criteria
A flagged match shows the full heatmap/timeline treatment; a routine match doesn't, without extra load time on the common case.
