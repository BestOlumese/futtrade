# Phase 00 — Repo & Infra Bootstrap

**Depends on:** None (first phase)
**Complexity:** S

## Goal
Prove the full deployment pipeline works end-to-end before any gameplay code exists — an empty "hello world" on every piece of infra, deployed and talking to each other.

## Tasks — COMPLETE
- [x] Scaffold Next.js (App Router, TypeScript strict), deploy to Vercel
- [x] Scaffold Neon Postgres project, wire Drizzle, run first migration
- [x] Enable the `timescaledb` extension on the Neon project (2.17.1)
- [x] Wire Better Auth, working sign-up/sign-in against Neon
- [x] Scaffold a Colyseus server (empty room) as a Docker image, deploy to Render
- [x] Confirm the Next.js client can open a WebSocket to the deployed Colyseus room and exchange a test message
- [x] Wire Inngest, deploy one no-op scheduled function, confirm it fires on schedule

Closed 2026-08-08. Verified against production, not locally:

| Piece | Evidence |
|---|---|
| App | https://futtrade.vercel.app — 200 |
| Neon + Drizzle | connected from the deployed app; 4 auth tables |
| `timescaledb` | enabled, 2.17.1 |
| Better Auth | sign-up, session and sign-in all 200 in production |
| Colyseus | https://futtrade-server.onrender.com — health 200, browser WebSocket round trip 317ms |
| CORS | hostile origin refused, own origin echoed with `Vary: Origin` |
| Inngest | `bootstrap-heartbeat` observed completing in the dashboard |

Re-check any time with `node scripts/verify-deploy.mjs <app-url> <server-url>`.

## Explicitly out of scope
- Any gameplay logic
- Any UI beyond auth screens
- Any player data model

## Exit criteria
A deployed Next.js app with working auth, a deployed Colyseus room reachable from it over WebSocket, and one working Inngest scheduled job — all in production, not just local.
