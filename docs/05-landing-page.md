# Landing Page

Built on `04-design-system.md` — read that first for tokens.

## Concept

The page's single job: convince a football-and-numbers person this is a real live game, not another idle-stats manager clone, within the first screen. The hero doesn't describe the product — it **is** the product, running.

## Hero

A live-look match card is the first thing on the page — not a headline over a gradient. It shows a fictional in-progress match: two club badges (simple geometric placeholder marks, not licensed crests), a running clock (`IBM Plex Mono`, tabular), a scoreline, a live event ticker scrolling beneath it ("64' — Yellow card, Adeyemi"), and — beside it — a small live price tick for one of the shown players, ticking up or down with a `signal`/`tally` colored delta. The `tally` dot pulses next to "LIVE."

On load: the clock and ticker begin "running" as the single orchestrated motion moment for the page (respecting `prefers-reduced-motion` — falls back to a static frozen frame with the LIVE badge still shown).

Headline sits to the side or beneath, short and plainspoken — not a tagline trying to be clever. Something in the register of: "Real matches. Real managers. A market that moves because they happened." (Placeholder copy — refine against actual brand voice before shipping, per the voice guidance in `04-design-system.md`.)

Primary CTA: "Start managing" (`signal`-colored button, sharp corners, no chamfer — buttons never get the panel treatment). Secondary: "Watch a live match" — links to a recorded/looping example rather than requiring a live one to exist for a first-time visitor.

## Section 2 — Three pillars, shown not told

Three chamfered panels side by side (or stacked on mobile), each demonstrating rather than explaining:

1. **Tactics that matter live** — a small static diagram: two tactical dial icons (mentality, pressing) with a one-line caption showing cause → effect ("Push pressing up. Concede space in behind."). Not a features list — a single concrete example.
2. **A squad that actually develops** — a small before/after attribute snapshot for one placeholder player across a season (CA moving, a specific stat labeled "+3 Finishing this month" — directly reflecting the `player_development_log` UI pattern from the features spec, so the marketing page previews something real, not invented for marketing).
3. **A market that reacts to what happens** — a small candlestick fragment tied to a labeled match event ("Hat-trick vs. Ikorodu FC" with a visible price spike at that point on the chart).

Each panel: chamfered top-left corner, `signal` edge-line, `pitch-shadow` background.

## Section 3 — How a live match actually works

A short numbered sequence (this is one of the few places numbering is earned — it's a genuine temporal sequence, per the design system's guidance to only number real sequences): Queue → Kickoff → Live decisions → Full time → Market reacts. Each step: one short line, no elaboration — this section's job is to make the mechanic legible at a glance, not sell it.

## Section 4 — Closing CTA

Restrained. Repeat the primary CTA once, no second gradient hero, no countdown/urgency gimmick. A single line of supporting text at most.

## Footer

Standard: links, socials if applicable. `steel`-bordered top rule, `floodlight` at muted opacity for text. Nothing decorative here — footers are navigation, not a design opportunity to spend more of the page's one signature move on.

## What this page deliberately does NOT do

- No stock photography of stadiums or players
- No animated gradient backgrounds
- No scroll-triggered fade-in on every single section (motion budget is spent on the hero)
- No numbered "01/02/03" markers on the three-pillar section (that's not a real sequence — order doesn't matter there, so no numbering, per the design system's guidance on earned structure)
