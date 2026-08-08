# Design System — "Floodlight Protocol"

Single source of truth for every visual decision in Futtrade. No raw hex codes, arbitrary sizes, or one-off spacing in component code — if a value isn't a token here, this doc needs updating, not the component.

## Design thesis

Futtrade is a **competitive game first** and a management tool second. It should feel like booting into a match, not like opening a spreadsheet — closer to Valorant's or EA FC's interface language than to a SaaS dashboard.

Two registers, deliberately different jobs:

- **Brand surfaces** (landing, auth, match intro) are cinematic: floodlight beams, atmospheric depth, heavy display type, glow. These sell the feeling.
- **Working surfaces** (match center, squad, Bourse) are dense and functional: tight rows, small type, maximum information per screen. These are where people spend hours.

The two share a palette, a shape language and a type system — so they read as one product — but they do not share a density. A landing page that breathes and a market screen that's packed are both correct.

**Explicitly rejected:** flat "default dark mode" with one accent (the previous system's failure — it read as a wireframe); generic SaaS card grids; grass textures and crest clichés; Bloomberg-orange finance styling; stock stadium photography.

---

## Color

Midnight blue base, electric lime as the single action color. The base is **blue-black, never neutral grey** — that cool undertone is what makes the lime read as electric rather than dirty.

| Token | Hex | Role |
|---|---|---|
| `midnight` | `#070B14` | Page background. Blue-black, the darkest surface. |
| `surface` | `#0E1523` | Panels and cards. Raised one step from `midnight`. |
| `surface-2` | `#151F33` | Nested panels, table row hover, inputs. |
| `lime` | `#C8FF2E` | **The action color.** Buttons, links, focus rings, key figures, positive market/form deltas. Carries essentially all interactivity. |
| `floodlight` | `#EAF0FA` | Primary text. Slightly blue-tinted white, never pure `#FFF`. |
| `live` | `#FF3B30` | **Liveness and loss.** The live dot, LIVE badges, negative deltas, destructive actions. |
| `steel` | `#4A5A72` | **Borders and dividers only.** 2.8:1 on `midnight` — it fails WCAG AA and must never be used for text. |
| `mute` | `#7D8BA3` | Secondary and label text. 5.3:1 on `surface`, so it clears AA. Use this wherever `steel` is tempting for words. |
| `card-yellow` | `#F5C518` | A booking, and nothing else. Not a brand colour — it's the colour of a real object, the way a red card is `live` red. Never use it as an accent or a warning state. |

**The rule that keeps this from going generic:** `lime` and `live` never do the same job. `lime` means *go, act, gain*. `live` means *happening now, or losing*. A red button that isn't destructive is wrong; a lime "LIVE" badge is wrong.

**Derived values** — compute, don't add new hexes:
- Muted text: `floodlight` at 55%; disabled at 35%
- Borders: `steel` at 35%; hover `steel` at 60%
- Lime glow: `lime` at 12–20% in a blur, never a solid halo
- Row hover: `surface-2`

**Contrast floor:** `floodlight` on `midnight` and on `surface` both clear WCAG AA at body sizes. `lime` on `midnight` clears AA. **`lime` is never used for body text on light fills** — it is an accent and a fill color, and `midnight` text on a `lime` button is the correct pairing, not the reverse.

---

## Typography

| Role | Face | Use |
|---|---|---|
| Display | **Space Grotesk** (500/700) | Headlines, scores, big figures. Geometric with real personality — the character of the brand lives here. Tight tracking at large sizes (−2% to −3%). |
| Body/UI | **Inter** (400/500/600) | All prose, labels, dense UI. Chosen for legibility at the small sizes the working surfaces demand. |
| Data | **JetBrains Mono** (400/500) | Every number that changes: scores, clocks, prices, deltas, timestamps. Always `tabular-nums`. |

**Sentence case for headlines.** Uppercase is reserved for short labels — badges, eyebrows, table headers, nav — where it functions as a signpost. A headline in caps reads as shouting.

Display type is deliberately large and heavy on brand surfaces and deliberately restrained on working surfaces. Both are the same system; only the scale changes.

---

## Shape language — the angular cut

The signature device is a **diagonal corner cut**, drawn from HUD and broadcast graphics. **Nothing in this system has a rounded corner** — no `border-radius` anywhere, on anything, with the single exception of the live dot (it models a light, not a corner).

- **Panels/cards:** cut on two opposing corners — top-left and bottom-right — at 14–20px. The opposition is what makes it read as deliberate rather than as a clipped mistake.
- **Accent edge-line:** a 2px line in `lime` traces the cut edges only, never the full border. `live` instead when the panel is genuinely in progress.
- **Bracket marks:** short 1px corner brackets on hero and feature panels — a HUD device, used sparingly. Not on every card, or they stop meaning anything.
- **Buttons:** a single cut on the bottom-right corner. Smaller than a panel's, and never bracketed.
- **Inputs and table cells:** plain rectangles. Cuts are for containers and actions, not for every element.

Density rule: on working surfaces, cuts appear on the outer container only — never on every row. A table of 40 angular rows is noise.

---

## Atmosphere

This is what separates cinematic from flat, and it is required on brand surfaces. All of it is generated in CSS/SVG — no raster imagery, no licensing, no payload.

**Layers, back to front:**

1. **Base wash** — a wide radial gradient from `surface` toward `midnight`, off-center. Establishes depth before anything else is drawn.
2. **Floodlight beams** — two or three wide, very low-opacity (3–6%) linear-gradient wedges angled down from above, as if from stadium rigs. They should be felt, not seen.
3. **Pitch grid** — a perspective-transformed line grid fading to nothing at the horizon, at 4–8% opacity. Anchors the space as a stadium without depicting one.
4. **Accent glow** — a large blurred `lime` radial behind key content at 12–20%. This is the single strongest "expensive" signal; one or two per page, never more.
5. **Grain** — a fine SVG `feTurbulence` noise at 3–5% over everything. Cheap, and the most reliable way to kill the flat default-dark-mode feel.

**Working surfaces get layers 1 and 5 only.** Beams and glow behind a data table hurt legibility, which always wins.

---

## The live dot

A 7px `live`-red dot with a soft pulsing glow, modeled on a broadcast tally light. Appears **only** next to something genuinely live: a match in progress, or a price during a settlement window. Always paired with the word "LIVE" — color is never the only signal.

If nothing is live, there is no dot. A UI covered in pulsing dots has none that matter.

---

## Motion

Motion is part of the product here, not decoration — but it is budgeted.

- **Hero:** layered parallax on scroll (beams, grid and content at different rates) plus the running clock and ticker. This is the page's set piece.
- **Numbers:** prices and scores roll rather than snap. Never let a live number reflow — that's what `tabular-nums` is for.
- **Glow:** slow, low-amplitude pulse on live elements only. Nothing else pulses.
- **Hover/focus:** 120ms, near-instant. No elaborate micro-interactions on working surfaces.
- **Scroll reveals:** at most once per section, and never on data.
- **`prefers-reduced-motion`:** every animation above stops. Parallax freezes, tickers hold their current frame, glow goes static, and the LIVE badge stays visible. A reduced-motion user must still be able to tell what's live.

---

## Density

| | Brand surfaces | Working surfaces |
|---|---|---|
| Base text | 16px | 13–14px |
| Row height | generous | 32–40px |
| Section spacing | 96–160px | 16–24px |
| Panels per screen | 1–3 | as many as the data needs |
| Atmosphere | full stack | wash + grain only |

---

## Voice & writing

- Name things by what the manager controls: "Set tactics," not "Configure formation parameters."
- Consistent verbs through a flow: "Queue for match" → "Queued" → "Match found," never three vocabularies.
- Live states speak plainly: "2-1, 63'" not "Currently leading in the second half."
- Errors state what happened and what to do, without apologizing: "Match disconnected. Reconnecting…" not "Oops, something went wrong!"
- Empty states invite action: "Scout your first player," not "No players found."

---

## Accessibility floor (non-negotiable)

- Responsive to mobile; the match center is the hardest case — test it specifically
- Visible `lime` focus ring on every interactive element
- Color is never the only signal: LIVE has a word, deltas have a sign and an arrow glyph
- `prefers-reduced-motion` fully respected, per Motion above
- Atmosphere never reduces text contrast below AA — if a glow makes text harder to read, the glow is wrong, not the text
