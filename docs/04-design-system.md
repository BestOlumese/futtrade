# Design System — "Stadium Floodlight"

This is the single source of truth for every visual decision in Empire Live. No raw hex codes, arbitrary font sizes, or one-off spacing values in component code — if something isn't a token here, that's a sign this doc needs updating, not that you should improvise in place.

## Design thesis

Empire Live lives at the intersection of two visual worlds: **live broadcast graphics** (tally lights, scoreboard clocks, lower-thirds, event tickers) and **a trading terminal** (tabular data, live deltas, urgent precision). The identity is built from the actual vocabulary of a stadium under floodlights at night — not football-generic (no grass textures, no crest clichés, no stock "pitch from above" hero shots) and not finance-generic (no Bloomberg-orange, no candlestick wallpaper).

**Explicitly rejected defaults**, per standard AI-design pitfalls: warm cream + terracotta serif, near-black + single acid-green/vermilion accent, broadsheet hairline-rule newspaper layout. Empire Live is dark, but the darkness carries two accents with distinct, non-overlapping jobs (see below) rather than one bright color doing everything — that's what keeps it from reading as the generic "dark mode SaaS" template.

---

## Color

| Token | Hex | Role |
|---|---|---|
| `void` | `#0A0D12` | Base background. Night stadium bowl — cool blue undertone, not pure black. |
| `floodlight` | `#F3F6FB` | Primary text and light-colored UI. The color of the light itself. |
| `signal` | `#35C7A6` | **Primary interactive accent.** Buttons, links, focus rings, positive market/form states. This is the color of general "go" — carries almost all interactivity. |
| `tally` | `#E8362E` | **Reserved exclusively for liveness and urgency.** The live-match indicator dot, "LIVE" badges, negative market/form states. Never used for a generic CTA. |
| `pitch-shadow` | `#132018` | Panel/surface tint — desaturated grass in shadow. Used only as a background fill for cards/panels, never as text or an accent. |
| `steel` | `#3E4A59` | Borders, dividers, muted/secondary text, disabled states. |

**Rule that keeps this from becoming generic:** `signal` and `tally` never appear in the same functional role. If you reach for `tally` on something that isn't literally live or literally urgent, that's the wrong token — use `signal` or `steel` instead.

**Derived states** (don't add new named colors for these — compute from the above):
- Muted/disabled text: `floodlight` at 45% opacity
- Panel border: `steel` at 30% opacity
- Hover state on `signal` elements: `signal` at 85% lightness (lighten, don't add a new hex)

---

## Typography

| Role | Face | Notes |
|---|---|---|
| Display | **Big Shoulders** (variable, condensed) | Headlines, scores, big numbers. Heavy weights (700-900), tight tracking (-1% to -2%). Uppercase reserved for genuine labels (badges, eyebrows), not full headlines — condensed caps at headline length reads as shouting. |
| Body | **IBM Plex Sans** | All prose, UI labels, descriptions. Regular/Medium weights only in body copy; reserve Semibold for emphasis within text, not whole paragraphs. |
| Data/mono | **IBM Plex Mono** | Any number that updates live: scores, prices, clocks, tickers, timestamps. Always with `font-variant-numeric: tabular-nums` so digits don't reflow as they change. |

Type scale is condensed-display-led: the display face should feel like it's doing real work (scoreboard, not decoration), so don't undersize it relative to body text the way a typical marketing site would.

---

## Layout signature — the clipped panel

Every card, panel, and modal in the system uses **one chamfered corner** (a 12-16px diagonal cut, top-left by default) instead of a rounded corner — this is the signature structural device, drawn from broadcast lower-third graphics and stadium signage, which never use soft border-radius. A 2px edge-line in `signal` or `tally` (matching the panel's semantic role) traces the chamfered edge only, not the full border.

- Standard panel: chamfered top-left, `steel` 30% border on the remaining three edges, `signal` edge-line on the chamfer
- Live/urgent panel (an in-progress match card): same shape, `tally` edge-line
- **Do not** apply the chamfer to small elements like buttons or form inputs — reserve it for panels/cards so it stays a meaningful signature rather than a decoration applied everywhere. Buttons and inputs use sharp rectangular corners (0px radius) — no rounding anywhere in the system, on anything.

## The tally dot

A small pulsing `tally`-red dot (6-8px), modeled on a broadcast camera's tally light. Appears next to:
- A currently-live match
- A live-updating price (during a settlement window)

Never appears decoratively. If nothing is actually live, there is no dot. This restraint is what keeps it meaningful — a UI that's covered in pulsing red dots has none that matter.

---

## Motion

- **Page load:** a single orchestrated moment, not scattered fade-ins per element. On the landing page specifically: the hero scoreboard component's clock and ticker begin "running" on load, as if you've just tuned into a broadcast already in progress — this is the one deliberate motion moment, everything else on the page is static.
- **Live match ticks:** dot positions interpolate smoothly between server ticks (never teleport, never extrapolate ahead of confirmed state — see `02-concerns.md`).
- **Hover/focus:** instant or near-instant (100-150ms), no elaborate micro-interactions — this is a data-dense, live-stakes product, not a portfolio site. Restraint here matters more than polish.
- **Respect `prefers-reduced-motion`** everywhere, including the hero's running-clock moment (fall back to a static "LIVE" state).

---

## Voice & writing

- Name things by what the manager controls: "Set tactics," not "Configure formation parameters." "Sell player," not "Execute transfer."
- Active voice, consistent verbs through a whole flow: a button that says "Queue for match" produces a status that says "Queued," never "Searching for opponent" followed by a toast that says "Match found" in different vocabulary.
- Live states speak plainly and immediately: "2-1, 63'" not "Currently leading in the second half."
- Errors state what happened and what to do, without apologizing: "Match disconnected. Reconnecting…" not "Oops, something went wrong!"
- Empty states are an invitation to act: an empty squad screen says "Scout your first player," not "No players found."

---

## Accessibility floor (non-negotiable, not a checklist to skip)

- Responsive down to mobile — the live match viewer is the hardest surface to get right here; test on it specifically, not just marketing pages
- Visible keyboard focus using the `signal` accent as the focus ring on every interactive element
- Color is never the only signal: the tally dot is paired with the word "LIVE," not color alone; market deltas show a +/- sign and arrow glyph alongside the color
- `prefers-reduced-motion` respected everywhere, as above
- Minimum contrast: `floodlight` on `void` and `floodlight` on `pitch-shadow` both meet WCAG AA at body-text sizes — verify before shipping any new panel background
