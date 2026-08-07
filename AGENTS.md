# AGENTS.md — Empire Live

You are working in the Empire Live codebase. Read this file fully before touching code. It tells you what this project is, how the docs are organized, and the non-negotiables that apply everywhere.

## What this is

Empire Live is an online football club-management game: tactics + squad/finance management + **live, real-time, matchmade 1v1 matches** with a Fotmox/Sofascore-style 2D match center, sitting on top of an FC-style fantasy player database whose attributes genuinely develop over time — and a two-sided player-share market (the Global Bourse) whose prices move off real match performance, not random noise.

One event stream (shot/pass/tackle/card/sub, each with location + players + xG/outcome) powers everything downstream: the live 2D viewer, post-match stats, player Form, and market price movement. Get that schema right; treat it as the spine of the whole system.

## Stack

- **Frontend/app shell**: Next.js (App Router), TypeScript strict, Zustand, TanStack Query, Tailwind
- **Live match engine**: Colyseus (Node) — authoritative rooms, built-in matchmaking, Phaser SDK client
- **2D rendering**: Phaser 3
- **Database**: Neon Postgres + Drizzle ORM, `timescaledb` extension enabled for price-history hypertables
- **Scheduled jobs**: Inngest (training/CA growth, Form decay, market settlement — never `pg_cron`, it silently skips during Neon scale-to-zero)
- **Auth**: Better Auth
- **Charts**: recharts
- **Deploy**: Next.js app on Vercel; Colyseus server on Render (separate service, not serverless), containerized so the host stays swappable — see "Colyseus hosting" below

Full stack rationale and comparison (PartyKit vs Colyseus vs Rust) lives in the project guide — see Doc Map below.

### Colyseus hosting

The server ships as a **plain Dockerfile**; `render.yaml` is a thin layer on top. This is deliberate — the container is the portability boundary, so moving to Fly.io, Railway, Koyeb, or a VPS is a config change with no code change.

Render's free tier was chosen for bootstrap because it needs no credit card and supports WebSockets. Two properties to keep in mind:

- An open WebSocket counts as traffic, so the ~15-minute idle spin-down **cannot interrupt a live match**. It only affects the first connection after an idle period.
- That first connection pays a cold start (~50s). Harmless while the only users are developers; it becomes a genuine matchmaking problem at **Phase 07**, which is the point to reassess paid always-on hosting. See `docs/concerns/07-cost-infra.md`.

## Doc map — read in this order for a new feature

1. `docs/phases/README.md` — 27 phases (00-26), where we are in the build, what's in/out of scope right now. Each phase has its own file with tasks and exit criteria.
2. `docs/concerns/README.md` — 8 cross-cutting risk docs (fairness, sync, timezone, data consistency, market integrity, scalability, cost, mobile perf) — check the relevant one before building anything real-time, financial, or player-data-related
3. `docs/features/README.md` — 9 feature specs, each cross-referenced to its phase(s) and relevant concern(s)
4. `docs/04-design-system.md` — visual identity: tokens, type, components, motion, voice. **Non-negotiable for any UI work.**
5. `docs/05-landing-page.md`, `docs/06-auth-pages.md`, `docs/07-dashboard.md`, `docs/08-live-match-viewer.md`, `docs/09-market.md` — per-surface design specs, all built on `04-design-system.md`

**Practical rule:** before starting any phase, open its file, then its listed feature spec(s), then any concern docs those reference. The cross-links exist so you're never implementing a phase without having read the concern that governs it.

The original wide-ranging project guide (concept, three-layer CA/Form system, full DB schema sketch, tech-stack research) is the source of truth for game-design detail not repeated here.

## Non-negotiables

- **Server-authoritative, always.** The Colyseus room owns match state. Clients render; they never decide outcomes. No exceptions, no "just for the demo."
- **Event-schema-first.** Before building any new stat, chart, or price mechanic, check whether it can be derived from the existing match-event stream before adding a new data path.
- **Design tokens, not hardcoded values.** Every color, font, and spacing value in `04-design-system.md` is a token. No raw hex codes or arbitrary Tailwind values in components — if a value isn't a token, that's a sign the design system needs updating, not that you should improvise.
- **Tabular numerals for anything live.** Scores, prices, clocks, tickers — always `IBM Plex Mono` with `font-variant-numeric: tabular-nums`. Never let live numbers reflow.
- **The tally dot means live, and only live.** Don't reuse the pulsing red indicator decoratively.
- **Hidden values stay hidden server-side.** True Current Ability, potential ceiling, and fogged scouting ranges must never be sent to the client in full — only the derived/fogged view the user is entitled to see.

## Working style

This project is documentation-first: don't start implementation on a feature until the relevant spec doc exists or has been updated. If a spec doc is missing or wrong for what you're about to build, stop and update the doc first, then build.
