# Concern: Cost Shape

**Applies to phases:** 00, 01

## The one always-on cost

The Colyseus server is an always-on process, unlike the serverless Next.js/Neon/Inngest pieces, which all scale to near-zero cost when idle. Budget for this differently from day one — it's the single piece of infrastructure with a baseline cost regardless of traffic, and it's also the piece most likely to need scaling investment first (see `06-scalability.md`).

### Bootstrap posture: Render free tier

Through the early phases this cost is deferred, not paid: the server runs on Render's free tier (no credit card, WebSockets supported). The tradeoff is a ~15-minute idle spin-down with a ~50s cold start on the next connection. An open WebSocket counts as traffic, so **a live match is never interrupted** — only the first connection after idle pays.

**Reassess at Phase 07 (Matchmaking Queue).** That's where a 50s cold start stops being a developer annoyance and starts being a player-facing queue failure. At that point the always-on cost above becomes real, and the container-first setup means switching hosts is a config change, not a rewrite.

## Neon scale-to-zero interactions

Neon's compute suspends after inactivity by default. This is fine for most of the app, but has a specific failure mode worth knowing: `pg_cron` jobs only run while the compute is active, so scheduled jobs silently skip during a scale-to-zero suspension unless scale-to-zero is disabled for that branch. This is exactly why Inngest, not `pg_cron`, is the primary scheduler for this project (training jobs, Form decay, market settlement) — Inngest is triggered externally and doesn't share this failure mode.

## Practical takeaway

Track the Colyseus server's cost separately from the rest of the stack when reviewing infra spend — it won't show the same usage-based curve as everything else, and that's expected, not a sign something's misconfigured.
