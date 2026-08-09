# Live Match Viewer

Built on [`04-design-system.md`](04-design-system.md). This is the single most
important screen in the product — the thing the whole game is built to deliver.
It needs to feel like tuning into a broadcast, not opening an app.

Underlying data spec: [`features/03-event-stream.md`](features/03-event-stream.md).
Feature spec: [`features/04-2d-match-viewer.md`](features/04-2d-match-viewer.md).

**Everything on this surface is derived from `match_event` and nothing else.**
That is not a style preference, it is the design rule from AGENTS.md: before
adding any stat, chart or panel here, check whether the event stream already
supports it. `totalsFrom()` derives a side's whole stat line from the log.

## Layered views

Three depths, one toggle, same event stream underneath:

1. **Default — stat ticker view.** Running xG chart (recharts, `lime` for home
   and `floodlight` for away), event ticker below it (`JetBrains Mono`
   timestamps, `Inter` event text), scoreline and clock always visible at the
   top regardless of which view is active.
2. **2D dot replay.** Phaser 3 canvas, 11 dots per side positioned per tick,
   client-interpolated between server ticks — see
   [`concerns/02-realtime-sync-reconnection.md`](concerns/02-realtime-sync-reconnection.md);
   never extrapolate ahead of confirmed state. Finesse-tagged shots render as a
   curved dotted trajectory to goal, power shots as straight lines. This is the
   visual-flair rule from the feature spec; no full physics animation needed.
3. **Full heatmap/timeline.** Reserved for flagged matches (derbies, finals, the
   user's own live matches) — post-match aggregate touch heatmap plus the full
   timestamped event log. Not shown by default on a routine match, to keep the
   interface calm on lower-stakes fixtures.

The toggle is a persistent, low-key control — a small tab group, `steel`
borders, `lime` active state. Never a modal, and it never interrupts the live
feed while switching.

**Phase ownership:** view 1's post-match form is **Phase 05**; its live form is
**Phase 06**; view 2 is **Phase 06**; view 3 is **Phase 22**.

---

## Phase 05 — the post-match summary

The first surface built on the event stream, and the proof that the schema
supports real UI. Route `/match/[id]`, visible to any signed-in user for any
match that has finished. No live requirement: this reads rows, it does not
subscribe to anything.

### Shot map

**One half-pitch, both teams overlaid**, home in `lime` and away in
`floodlight`. This works because of the coordinate convention in the event
stream spec: `x` is always measured toward the goal the acting side is
attacking, so every shot in the log already points the same way. Two teams on
one goal is the densest possible answer to "who got closer".

Encoding, three channels that don't fight each other:

| Channel | Meaning |
|---|---|
| **Radius** | xG. A big dot is a big chance — this is the map's entire point |
| **Fill** | outcome: goal is solid with a ring, saved is solid, off target is hollow, blocked is hollow and dashed |
| **Colour** | team, and only team |

A goal additionally carries a short label with the scorer's shirt. Colour is
never the only signal — outcome is carried by fill, so the map survives being
read by someone who cannot separate lime from white.

Drawn in **SVG, not canvas**: a few dozen dots, crisp at any density, hoverable,
and themeable with the same tokens as everything else. Phaser is for the moving
pitch in Phase 06, not for a static plot.

### Stat card

Seven rows, every one a count or a sum over the same rows:

```
Possession     54%    46%
Shots         13 (6)  10 (4)      ── on target in brackets
xG             1.29   0.94
Pass accuracy   79%    76%
Tackles          31     22
Fouls            11     13
Cards          2Y 0R  1Y 1R       ── card-yellow and live
```

All numbers `JetBrains Mono`, `tabular-nums`. A split bar under each row, `lime`
against `floodlight`, so the shape is readable before the digits are.

**Possession is pass share** — your passes over all passes — which is how real
providers compute it from event data, and the only definition derivable from the
log. The sim's own possession figure uses the same definition, so the stored
column and the displayed number are the same number rather than two estimates of
the same thing.

### xG race

A cumulative xG line per side against the match clock, `recharts`. Steps at each
shot, so a flat stretch reads as a quiet spell and a jump reads as a big chance.
Goals marked on the line. This is the most convincing single demonstration that
the event schema supports real UI, which is why the phase includes it.

### Timeline

Goals and cards only — not a full ticker, which belongs to the live view. Minute,
glyph, shirt number. A second yellow shows as two entries, because that is what
the referee did and what the log records.

### Top performers

Three or four shirts a side: shots, goals, assists, cards. Keyed by shirt number
today and by `player_id` from Phase 10, with the same query either way. It is the
exact shape Phase 20's player ratings need, built early because the data already
supports it.

---

## Top bar — the scoreboard

Always visible regardless of which view is active. The broadcast lower-third made
literal:

- Both club marks, scoreline, running clock — all `JetBrains Mono`, tabular
- The live dot pulsing next to "LIVE", and **only** when genuinely live
- A compact form-guide strip is deliberately **not** here — this bar's only job
  is the current match, and nothing else competes for space in it

No chamfered-panel treatment on the bar itself: it's a full-width broadcast bar,
not a card, and shouldn't be treated like one.

## Manager controls — the tactics panel

A collapsible side panel (desktop) / bottom sheet (mobile), visible only to the
two managing users, never to spectators or traders watching the same match:

- Two tactical dials in Phases 01–02 (mentality, pressing), expanding to
  formation and the full range later — rendered as physical-feeling controls,
  not dropdowns, since these are the game's core live decisions
- Substitution queue: tapping a bench player queues them with a visible countdown
  matching the server-enforced delay. The countdown is not decorative — it shows
  the actual server-side timer, so the UI never claims a sub is in before the
  server confirms it
- Remaining action counters (subs left, tactical changes left this half) always
  visible near the controls. Server-truth counts, never client-estimated

## Spectator / trader view

Same top bar and same stat/replay views, no tactics panel. A live price ticker
for players in the match sits where the tactics panel would be for a manager —
the trader's version of the same screen, reusing the layout rather than being a
separate design.

## Momentum graph

A thin horizontal bar beneath the scoreboard, `lime` against `floodlight`,
updating per tick window. Directly answers "who's on top right now" without
reading the stat card in detail. A glance-level element, intentionally small.

## Disconnection / reconnection state

Per [`concerns/02-realtime-sync-reconnection.md`](concerns/02-realtime-sync-reconnection.md)
this needs a real, decided UI state — not a spinner that could mean anything.
Show "Reconnecting…" with the last-known score frozen and **clearly marked as
last-known**, not silently continuing to animate.

## What this surface deliberately does not do

- No fake crowd-noise visualiser or stadium-atmosphere graphics competing with
  real data
- No modal interruptions for tactical changes — everything happens in the
  persistent panel, so the live feed is never covered
- No second data path. If a number can't be derived from `match_event`, the
  answer is to fix the event stream, not to add a column feeding this screen

---

## Boundary: `lib/demo` is not this surface

`lib/demo/` (`timeline.ts`, `clock.ts`) drives the **landing page's** scripted
match centre — a hand-authored 150-second loop with hard-coded goals, used to
sell the product to someone who has not signed up. It has no phase, because it
is marketing rather than gameplay, and it shares no code with anything here.

Two rules keep that from becoming confusing:

- **Nothing in `lib/demo` may be imported by a real match surface.** The real
  viewer reads `match_event`; the demo reads a script. If they ever shared a
  renderer, a change to one would silently alter the other.
- **Nothing here should be back-ported into `lib/demo` for consistency.** The
  demo is allowed to be prettier and faker than the real thing. It is a trailer.

See [`05-landing-page.md`](05-landing-page.md) for that surface. That doc has
drifted from what shipped and is owed a pass of its own.
