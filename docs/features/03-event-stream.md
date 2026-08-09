# Feature: Event Stream

**Phase:** 04
**Concerns:** [04 data consistency](../concerns/04-data-consistency.md), [08 mobile performance](../concerns/08-mobile-performance.md)

## Spec

- Every shot/pass/tackle/card/sub emits a structured event: `{ type, tick, location: {x,y}, players: [...], xg?, outcome }`
- Stored in `match_events`, keyed by `match_id`
- This is the single source for: shot map, heatmap, momentum graph, live ticker, `match_performance_log` ratings, and Form nudges

## Acceptance

The shot map, event ticker, and momentum graph for a completed match are all derivable from `match_events` alone with no separate data path.

## Design rule

Before building any new stat, chart, or price mechanic anywhere in the product, check whether it can be derived from this existing event stream before adding a new data path. This is the spine of the whole system — treat it accordingly.

---

## The schema, as built

Table `match_event`. One row per event, ordered within a match by `seq`.

| column | type | notes |
| --- | --- | --- |
| `id` | text pk | |
| `match_id` | text | FK → `match.id`, cascade delete |
| `seq` | integer | **1..N, contiguous, no gaps.** See below |
| `tick` | integer | the sim tick that produced it, 1..30 |
| `minute` | integer | display clock; spread *within* the tick, not derivable from it |
| `side` | text | `home` \| `away` — the side of the primary actor |
| `type` | text | `shot` \| `pass` \| `tackle` \| `card` \| `sub` |
| `outcome` | text | per type, below |
| `x` | real | 0–100, **always toward the acting side's attacking goal** |
| `y` | real | 0–100, 0 = one touchline, 100 = the other |
| `xg` | real null | shots only |
| `end_x` | real null | **shots only** — where the ball's flight ended, 0–100 |
| `end_y` | real null | shots only — across the pitch, 0–100 |
| `end_z` | real null | shots only — height in metres at that point |
| `shirt` | integer | 1–11, the primary actor |
| `secondary_shirt` | integer null | per type, below |
| `player_id` | text null | **Phase 10** fills this in. Null until squads exist |
| `secondary_player_id` | text null | as above |

### `seq` is the integrity guarantee

`seq` runs 1..N with no gaps, and `(match_id, seq)` carries a unique index. This
makes the exit criterion — "no gaps" — a property the *database* enforces rather
than something a test hopes to notice:

- a duplicate insert (a retried flush) violates the unique index and is rejected
- a lost batch shows up as `max(seq) != count(*)`, which is one cheap query

Both are checked by `npm --prefix server run events:verify`.

### Outcomes and who the secondary player is

| type | `outcome` | `shirt` | `secondary_shirt` |
| --- | --- | --- | --- |
| `shot` | `goal` \| `saved` \| `off_target` \| `blocked` | the shooter | the assister, **same side**, often null |
| `pass` | `complete` \| `incomplete` | the passer | the intended receiver, **same side** |
| `tackle` | `won` \| `foul` | the tackler | the player dispossessed or fouled, **the opposing side** |
| `card` | `yellow` \| `red` | the carded player | null |
| `sub` | `on` | the player coming on | the player going off, **same side** |

`tackle` is the only type whose secondary player is on the other side. That rule
is worth remembering rather than re-deriving: a heatmap that attributes a foul to
the wrong team looks subtly wrong in a way nobody can put their finger on.

### Shot placement, and why it is stored rather than drawn

`end_x`/`end_y`/`end_z` record **where the ball's flight ended**, so a shot map
can draw the trajectory rather than only the origin:

| outcome | ends at |
| --- | --- |
| `goal` | the goal line, inside the frame |
| `saved` | the goal line, inside the frame — on target, kept out |
| `off_target` | the goal line, wide of a post or above the bar (`end_z > 2.44`) |
| `blocked` | **short of the goal**, where the defender got in the way |

This is a deliberate schema addition rather than something the renderer invents.
A line has to point somewhere, and the three honest choices were: store the
placement, aim every line at the goal centre, or fabricate it in the component.
The third would mean the page drew detail no data supported — precisely what the
event-schema-first rule in AGENTS.md exists to prevent, and two viewers of the
same match could disagree. The first also gives Phase 22 its goal-mouth view for
nothing.

Placement is **descriptive, never causal**: the sim has already decided whether
the shot went in, and the placement is then made consistent with that decision.
It is drawn from the cosmetic random stream for exactly that reason, so it cannot
move a scoreline.

The goal is 7.32 m wide and 2.44 m high — 10.76 and 3.59 units on the pitch's y
scale — so `end_y` between 44.6 and 55.4 is inside the posts.

**Matches recorded before this existed have null placement**, and cannot be
backfilled: where a shot went was never observed, and deriving it now would be
inventing it. Their shot maps draw dots without lines, and say so.

### Coordinates

`x` is always measured **toward the goal the acting side is attacking**, for both
sides and in both halves. So `x = 95` is a shot near the opponent's goal whether
it was taken by home or away.

This is deliberate. The alternative — absolute pitch coordinates plus a
direction-of-play flag — means every consumer of the stream has to remember to
flip, and the one that forgets produces a shot map with half the shots in its own
box. Rendering a real pitch (Phase 06) flips once, at the renderer, where the
direction of play is already a rendering concern.

The pitch is 105 × 68 m, so one `x` unit is 1.05 m and one `y` unit is 0.68 m.

### What the sim does not emit yet

`sub` is defined in the taxonomy and accepted by the schema, but **nothing emits
it**, because substitutions need a squad and squads are Phase 09. The type exists
now so that Phase 10 adds a producer rather than a migration.

`player_id` is likewise null on every row written today. Events identify a player
by side and shirt number, which is meaningful on its own and survives the arrival
of real players unchanged — Phase 10 backfills the id alongside the shirt rather
than replacing it.

---

## How events are produced

The Phase 02 sim is a probability tree with no spatial model and no notion of an
individual player. Phase 04 does not replace it — the tuned distribution is
proven and must not move. Instead every event is **derived from what the sim
already decided**, so the positions and players genuinely correlate with the
outcome rather than being decoration:

- **Shot location comes from its chance quality.** Distance from the centre of
  the goal falls off as `5 + 28·(1−q)⁹` metres, and the angle spread widens as
  quality drops. Measured over 3,000 matches that gives shot distances of
  **p10 7.6 m, median 15.8 m, p90 25.4 m**, against roughly 7 / 17 / 28 in real
  top-flight football. A shot map therefore shows the real relationship between
  position and danger, which is the only thing a shot map is for.

  The exponent is high because it has to be: the sim draws chance quality from a
  narrow band around 0.10, so a gentler curve maps almost every shot to the same
  distance and the map comes out as an empty ring at 24 m. What it still cannot
  produce is a genuine tap-in, because the sim has no such thing as a 0.6 chance
  — a Phase 02 property of the quality distribution, to be fixed there rather
  than by distorting this curve.
- **Pass and tackle volume follow the dials.** Possession share drives how many
  passes each side plays; pressing drives how many tackles are attempted and how
  far upfield they happen.
- **Shirt numbers follow role.** A 4-4-2: `1` GK, `2–5` defence, `6,7,8,11`
  midfield, `9,10` attack. Shots weight toward the front, tackles toward the
  back, passes toward midfield. Per-player stat lines therefore look like
  football before real players exist.

### Passes are sampled, not exhaustive

A real match has roughly 900 passes. The sim resolves a match in 30 ticks of 3
simulated minutes each, so per-touch fidelity would be invented detail dressed as
data. Roughly 8–12 pass events are emitted per tick — about 300 a match — which
is ample positional density for a heatmap and keeps a match at ~370 rows total.

If a later phase needs true pass counts, that is a *stat* on the match record,
not 600 more rows.

### Cards have consequences

A card that changes nothing is decoration, and this product does not ship
decoration. Fouls are driven by pressing, a fraction become yellows, a second
yellow is a red exactly as the referee shows it, and a red genuinely reduces that
side's shot volume and worsens the chances it concedes for the rest of the match.

Measured over 40,000 matches, moving from low to high pressing costs:

| | fouls | yellows | reds |
| --- | --- | --- | --- |
| low | 9.60 | 1.48 | 0.055 |
| medium | 11.01 | 1.69 | 0.072 |
| high | 12.85 | 1.97 | 0.098 |

Worth being honest about the size of that: the red-card risk nearly doubles,
which sounds dramatic, and amounts to one extra dismissal every twenty-four
matches, which does not. Cards are a texture on the pressing decision, not the
thing that decides it — the real cost of pressing high remains `concedeQuality`.

One deliberate correction sits inside this. Without it, ~1.8 bookings a side
spread over eleven role-weighted players collide often enough by pure birthday
paradox to produce **0.31 reds a match**, three times the real rate. A booked
player is usually spared the next one, because in the real game he backs out of
challenges and his manager takes him off. That brings it to 0.15, against ~0.10
in real football.

Because reds stay rare, the Phase 02 tuning targets still hold — asserted, not
assumed: `npm --prefix server run sim:tune` is re-run after any change here.

## Deriving anything from the stream

`totalsFrom(events, side)` in `server/src/sim/events.ts` returns a side's whole
stat line — shots, goals, xG, fouls, cards, passes, pass completion, tackles —
from the event log and nothing else. It is the design rule above made into a
function, and it is what the Phase 04 exit criterion is asserted against.

Reach for it before adding any new column.

---

## Persistence

### The match row exists before the events do

A `match` row is inserted **at kickoff** with `status = 'live'`, so events have a
real foreign key from the first flush onward. Full time updates the row with the
final score and flips `status` to `'finished'`. A room disposed mid-match leaves
`status = 'live'` and is swept to `'abandoned'`.

This is why abandoned matches are *visible* rather than absent — a match that
crashed at the 60th minute is a row you can find and investigate, not silence.

### Flush cadence

Events buffer in memory and flush **every 5 ticks and again at full time** — six
batched inserts a match instead of ~370 round trips. Each flush is a single
`INSERT ... SELECT * FROM unnest(...)` statement, so a 60-event batch is one
network call.

The trade this makes: a process restart loses at most 5 ticks (15 simulated
minutes) of in-flight events. Writing once at full time would be fewer round
trips but would lose the entire match; writing every tick would put Neon in the
hot path of a 3-second loop for no real gain.

A failed flush is logged loudly and **never takes the room down**. The managers
still get their match; the gap is detectable afterwards by the `seq` check.

### Live delivery

Each tick's events are also `broadcast` to the room as they happen, so Phase 06's
ticker and 2D viewer have a live feed. They are deliberately **not** part of the
replicated Colyseus schema: state deltas stay small, and a reconnecting client
refetches the log from Postgres rather than re-downloading 300 events through the
state sync — see [concern 08](../concerns/08-mobile-performance.md).

### The aggregates on `match` are a checksum

`match` keeps its denormalised `home_shots` / `home_xg` / `home_possession`
columns even though they are now derivable, so a match-history list is one cheap
query rather than an aggregation over hundreds of rows per match.

The duplication is made safe by being *asserted*: the verification harness sums
the event log and requires it to equal the stored aggregates exactly. Drift
between the two is a test failure, not a silent inconsistency. This is the
concrete form of the exit criterion.
