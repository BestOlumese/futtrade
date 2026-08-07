# Phase 00 — Repo & Infra Bootstrap

**Depends on:** None (first phase)
**Complexity:** S

## Goal
Prove the full deployment pipeline works end-to-end before any gameplay code exists — an empty "hello world" on every piece of infra, deployed and talking to each other.

## Tasks
- [x] Scaffold Next.js (App Router, TypeScript strict) — [ ] deploy to Vercel
- [x] Scaffold Neon Postgres project, wire Drizzle, run first migration
- [x] Enable the `timescaledb` extension on the Neon project (2.17.1)
- [x] Wire Better Auth, working sign-up/sign-in against Neon
- [x] Scaffold a Colyseus server (empty room) as a Docker image — [ ] deploy to Render
- [x] Confirm the client can open a WebSocket to the Colyseus room and exchange a test message (verified locally) — [ ] re-verify against the deployed room
- [x] Wire Inngest, one no-op scheduled function registered — [ ] deploy it and confirm it fires on schedule

Remaining work is account-bound (Vercel / Render / Inngest credentials) and is
written up step by step in `DEPLOY.md` at the repo root. `/bootstrap` in the
running app renders the live status of all four pieces.

## Explicitly out of scope
- Any gameplay logic
- Any UI beyond auth screens
- Any player data model

## Exit criteria
A deployed Next.js app with working auth, a deployed Colyseus room reachable from it over WebSocket, and one working Inngest scheduled job — all in production, not just local.
