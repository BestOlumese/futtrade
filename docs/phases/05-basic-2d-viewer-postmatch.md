# Phase 05 — Basic 2D Viewer (Post-Match)

**Depends on:** 04
**Complexity:** M
**Status:** complete, closed 2026-08-09

## Goal
Prove the event schema actually supports real UI, not just storage.

## Tasks
- [x] Shot map component: plot events on a half-pitch, size/color by xG and outcome
- [x] Stat card view: possession, shots, cards — all derived purely from `match_events`
- [x] Post-match summary page combining both, no live/real-time requirement yet

## Explicitly out of scope
- Live rendering, 2D dot replay, heatmaps

## Exit criteria
Shot map and stat cards render correctly for any completed match with zero additional data path beyond `match_events`.

---

## What was built

`/match/[id]`, visible to any signed-in user for any finished match. Full surface
spec in [docs/08-live-match-viewer.md](../08-live-match-viewer.md) § Phase 05.

Two queries run on the page: the `match` row for identity and result, and its
event log. **Everything else is a fold over that log** —
[`lib/match/derive.ts`](../../lib/match/derive.ts) holds every one:

| Panel | Derived from |
| --- | --- |
| Shot map | `type = 'shot'` — position, xG, outcome, shirt |
| Stat card | counts and sums over the whole log |
| xG race | running sum of `xg` by minute, stepped |
| Timeline | goals and cards only |
| Who did what | grouped by `shirt` |

Plus a recent-matches list on `/match` and a summary link at full time — without
them the page is only reachable in the ninety seconds after the whistle, which
makes it both hard to use and hard to test.

## The possession problem, and what it forced

Possession was the one stat **not** in the event log: the sim counted ticks in
which a side held the majority of the ball, and only the `match` row carried the
number. Showing it would have meant a second data path on the one page whose
exit criterion forbids exactly that.

So possession is now **pass share** — your passes over all passes, which is how
real providers compute it from event data — and the sim was changed to use the
same definition, so there is one number rather than two estimates of one.
Consequences, all verified:

- pass and tackle volume moved from the sim's cosmetic random stream to its main
  one, since they now determine a displayed statistic
- `sim:tune` still passes, and the pressing confidence interval **tightened**
  from ±0.18pp to ±0.06pp — pass share is a far less noisy estimator than
  counting ticks
- [migration 0006](../../drizzle/0006_backfill_possession.sql) backfills matches
  already recorded, since their events survive and the new figure is recoverable
  exactly. Pre-Phase-04 matches have no log and are left alone

## How it was verified

```
npm run match:check                    # app derivation vs stored aggregates
npm --prefix server run events:verify  # log vs the sim's internal state
npm --prefix server run sim:tune       # Phase 02 targets after the change
```

`lib/match/derive.ts` deliberately **mirrors** `server/src/sim/events.ts` — two
separate deployments that share no code, as with `match-ticket.ts` and
`force-ipv4.ts`. Mirrored code drifts, so `match:check` recomputes real finished
matches with the app's implementation and requires them to equal what the match
server stored. It caught the pre-change possession rows on its first run.

The page was then checked **in a browser**, desktop and mobile, against a real
two-manager match. Three bugs came out of that which no amount of code review
would have found:

- **The pitch geometry was wrong.** Events store `x` and `y` both on 0–100, but a
  pitch is 105 m × 68 m — so an x-unit is 1.05 m and a y-unit is 0.68 m. SVG
  scales both axes equally, so the penalty area rendered half again too tall. The
  map is now drawn in metres.
- The xG chart's y-axis labels were clipped to `.35` and `.45` by a negative left
  margin.
- The shot map left a large empty rectangle beside it, because the stat card is
  short and the map is tall. The timeline now shares that column.

## The shot map, second time

The first version overlaid both teams on one half-pitch. Shown a real match, it
was a blob: a 0.40-xG chance drew a **7.4-metre-wide** circle, twenty-six of them
piled into one penalty area, and colour was doing all the work of telling the
sides apart.

Rebuilt: **a tab per team**, **a trajectory line on every shot**, and dots capped
at about a quarter of their previous area. The line is the fix — a dot says where
a shot was struck, the line says what became of it.

That required a schema change, because the event log stored no end point. The
three honest options were to store the placement, aim every line at the goal
centre, or fabricate it in the component. The third would have meant the page
drawing detail no data supported, which is what the event-schema-first rule
exists to prevent — so `match_event` gained `end_x`, `end_y` and `end_z`
([migration 0007](../../drizzle/0007_little_leo.sql)), and Phase 22's goal-mouth
view now has its source for nothing.

Placement is **descriptive, never causal** — the sim has already decided whether
the shot went in — so it is drawn from the cosmetic random stream. `sim:tune`
after the change is byte-identical, which is the proof.

The verifier gained invariants for it: placement belongs to shots and nothing
else, and the outcome and the placement must tell the same story. A `goal` that
ended wide of the post, or a `blocked` that reached the goal line, would draw a
line contradicting its own label. It also now reports the split — **35% on
target, 23% wide, 12% over, 29% blocked**, against a real 33/26/12/29, which is
what prompted a small correction to the outcome constants.

Matches played before this draw dots without lines and say so; they cannot be
backfilled, because where the ball went was never observed.

## Noted for later

- **The shot map has no genuine tap-in**, and it shows: the chance-quality band
  is narrow, so shots cluster at similar distances. That is the Phase 02 quality
  distribution, not the location mapping, and it resolves when attributes and
  chance types arrive.
- **`docs/05-landing-page.md` is still drifted** from the match centre that
  shipped. Out of scope here; owed a pass of its own.
- Test data was left in place so the page can be looked at: two `@futtrade.test`
  accounts and one match. See the closing notes in the Phase 05 commit for the
  one-liner that removes them.
