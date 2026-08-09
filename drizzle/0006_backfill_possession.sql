-- Phase 05: possession becomes pass share, and history is corrected to match.
--
-- Until now `match.home_possession` counted the ticks in which a side held the
-- majority of the ball. Phase 05 redefines possession as pass share — your
-- passes over all passes — because that is the only definition derivable from
-- `match_event`, and the stat card must not need a second data path.
--
-- Matches already recorded therefore carry a number computed a different way.
-- They are not wrong so much as measured with a different instrument, and
-- leaving them would mean `npm run match:check` fails forever on rows nobody
-- can fix. Their events are still on record, so the new figure is recoverable
-- exactly rather than estimated.
--
-- Matches from before Phase 04 have no event log and are left alone: there is
-- nothing to derive from, and overwriting their possession with a guess would
-- be worse than an inconsistency that is at least explainable.

UPDATE "match" AS m
SET home_possession = sub.pct
FROM (
  SELECT
    match_id,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE side = 'home' AND type = 'pass')
      / NULLIF(COUNT(*) FILTER (WHERE type = 'pass'), 0)
    )::int AS pct
  FROM match_event
  GROUP BY match_id
) AS sub
WHERE m.id = sub.match_id
  AND sub.pct IS NOT NULL
  AND m.home_possession IS DISTINCT FROM sub.pct;
