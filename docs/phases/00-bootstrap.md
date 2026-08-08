# Phase 00 — Repo & Infra Bootstrap

**Depends on:** None (first phase)
**Complexity:** S

## Goal
Prove the full deployment pipeline works end-to-end before any gameplay code exists — an empty "hello world" on every piece of infra, deployed and talking to each other.

## Tasks
- [x] Scaffold Next.js (App Router, TypeScript strict), deploy to Vercel
- [x] Scaffold Neon Postgres project, wire Drizzle, run first migration
- [x] Enable the `timescaledb` extension on the Neon project (2.17.1)
- [x] Wire Better Auth, working sign-up/sign-in against Neon
- [x] Scaffold a Colyseus server (empty room) as a Docker image, deploy to Render
- [x] Confirm the Next.js client can open a WebSocket to the deployed Colyseus room and exchange a test message
- [x] Wire Inngest — [ ] confirm a scheduled run actually fires

Verified against production on 2026-08-08 with `node scripts/verify-deploy.mjs`:
Colyseus health 200, WebSocket round trip from a real browser (399ms), Neon
connected, `timescaledb` enabled, Inngest endpoint protected by its signing key.
Sign-up, session and sign-in all 200 against the deployed app.

`ALLOWED_ORIGINS` was set on 2026-08-08 and verified: a request claiming to come
from `evil.example.com` now receives no `Access-Control-Allow-Origin` header,
while `https://futtrade.vercel.app` is echoed back with `Vary: Origin`. The
browser handshake still succeeds afterwards (317ms), which is the check that
matters — a slightly wrong value here locks out the real app rather than the
attacker.

One item remains before this phase is closed:

- **A `bootstrap-heartbeat` run must be observed in the Inngest dashboard.**
  Registering the function is not the exit criterion — the whole reason this
  project uses Inngest rather than `pg_cron` is that a scheduler which silently
  never runs is the failure mode being designed against. This one cannot be
  checked from outside; it has to be read off the Runs tab.

## Explicitly out of scope
- Any gameplay logic
- Any UI beyond auth screens
- Any player data model

## Exit criteria
A deployed Next.js app with working auth, a deployed Colyseus room reachable from it over WebSocket, and one working Inngest scheduled job — all in production, not just local.
