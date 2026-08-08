# Landing Page

Built on `04-design-system.md` — read that first for tokens, shape language and the atmosphere stack.

## Concept

One job: convince a football-and-numbers person, within the first screen, that this is a real live game — not another idle-stats manager clone. The hero doesn't describe the product, it **runs** it.

This is a **brand surface**, so it gets the full atmosphere stack and the long cinematic scroll. It is the one place in the product that is allowed to be spectacular.

## Section order

1. Hero
2. Match center preview
3. Tactics
4. Development
5. The Bourse
6. How a live match works
7. Numbers band
8. Closing CTA
9. Footer

---

## 1. Hero

Full-height. Atmosphere layers 1–5 all present: base wash, floodlight beams, perspective pitch grid, one `lime` glow behind the match card, grain over everything. Layers parallax at different rates on scroll.

Left: the headline in display type, large and heavy, sentence case. Beneath it one plain-spoken line, then the primary CTA ("Start managing", `lime` fill, `midnight` text, bottom-right cut) and a secondary ("Watch a live match", outlined).

Right: a **live-look match card** — bracket-marked, `live` edge-line on its cuts. Two geometric club marks (never crests), a running clock and scoreline in mono, a possession bar, and an event ticker beneath ("64' — Yellow card, Adeyemi"). Beside or below it, one player's Bourse price ticking with a signed, arrowed delta.

On load the clock and ticker start running, as if tuning into a broadcast already in progress. Under `prefers-reduced-motion` this freezes on a coherent frame and keeps the LIVE badge.

## 2. Match center preview

The strongest proof the product is real: a wide, dense panel showing what a live match actually looks like — a 2D pitch with player dots, a shot map or momentum strip, and a scrolling event feed with xG values.

Density is the point. This section should look *busy* in a way the rest of the page doesn't, because that's the honest preview of the product.

## 3. Tactics

Two or three tactical dials as segmented meters with a cause→effect caption ("Push pressing up. Concede space in behind."). Show one concrete consequence, not a feature list.

## 4. Development

A player card with a CA progression line and a short development log ("+3 Finishing this month"). Must mirror the real `player_development_log` UI from the features spec — the marketing page previews something real, not something invented for marketing.

## 5. The Bourse

A market table — several players, prices, signed deltas, sparklines — plus one price chart with a labeled match event marking a spike ("Hat-trick vs. Ikorodu FC"). This is a working surface shown inside a brand surface, so it uses working-surface density: tight rows, small type, no cuts on individual rows.

## 6. How a live match works

Queue → Kickoff → Live decisions → Full time → Market reacts. Numbered, because this is a genuine temporal sequence — unlike sections 3–5, which are unordered and must never be numbered. One short line per step.

## 7. Numbers band

A tight band of large mono figures (players tracked, matches played, events per match, market volume). Placeholder values until real ones exist — but the band earns its place by being the only place on the page where mono type goes large.

## 8. Closing CTA

Restrained. Repeat the primary CTA once, one supporting line, one `lime` glow. No second hero, no countdown, no urgency gimmick.

## 9. Footer

Navigation, not decoration. `steel` top rule, muted text, no atmosphere.

---

## What this page deliberately does NOT do

- No stock photography — all atmosphere is generated in CSS/SVG
- No scroll-triggered fade-in on every element; reveals are once per section at most, and never on data
- No numbered markers on sections 3–5 (not a real sequence — section 6 is)
- No second glow competing with the hero's; one or two per page total
- No rounded corners anywhere, per the shape language
