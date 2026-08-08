# Deploying Phase 00

Everything in this repo runs and is verified locally. What remains is the part
that needs your accounts: pushing it to production. Phase 00's exit criteria is
explicitly "in production, not just local," so the phase isn't closed until
these steps are done.

All four services below have a free tier that needs **no credit card**.

---

## Status

| Piece | Local | Production |
|---|---|---|
| Next.js app | ✅ builds, runs | ⬜ deploy to Vercel |
| Neon Postgres + Drizzle | ✅ migrations applied | ✅ already production (Neon has no separate local DB) |
| `timescaledb` | ✅ enabled (2.17.1) | ✅ same database |
| Better Auth | ✅ sign-up + sign-in verified against Neon | ⬜ needs Vercel env vars |
| Colyseus server | ✅ boots, WS round-trip 5ms | ⬜ deploy to Render |
| Inngest | ✅ route registers 1 function | ⬜ needs keys + a real scheduled run |

---

## 1. Push to GitHub

```bash
gh repo create futtrade --private --source=. --push
# or: create the repo in the browser, then
#   git remote add origin git@github.com:<you>/futtrade.git
#   git push -u origin main
```

`.env` is gitignored. Confirm before pushing:

```bash
git status --porcelain | grep -c '\.env$'   # must print 0
```

---

## 2. Deploy the Colyseus server to Render

Do this **before** Vercel, because the app needs the server's URL.

1. Render dashboard → **New** → **Blueprint**, and point it at the repo.
   It reads [`render.yaml`](render.yaml) and creates the `futtrade-server`
   Docker service.
2. Wait for the first build. Check the logs for `[colyseus] listening on 0.0.0.0:<port>`.
3. Confirm health:
   ```bash
   curl https://<your-service>.onrender.com/healthz
   # {"status":"ok","uptime":...}
   ```
4. Leave `ALLOWED_ORIGINS` unset for now — you'll set it in step 4, once you
   know the Vercel URL.

**Free-tier behaviour, so it doesn't surprise you later:** the service spins
down after ~15 minutes with no traffic, and the next connection takes ~50s to
wake it. An open WebSocket counts as traffic, so this can never interrupt a
live match — it only affects the first connection after an idle spell.
Reassess at Phase 07 (see `docs/concerns/07-cost-infra.md`).

---

## 3. Deploy the app to Vercel

Import the repo at vercel.com/new. Framework detection (Next.js) is correct;
leave the build settings alone.

Set these environment variables **before** the first deploy:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Same pooled Neon string as your local `.env` |
| `BETTER_AUTH_SECRET` | **Generate a new one** — do not reuse the local value |
| `BETTER_AUTH_URL` | `https://<your-app>.vercel.app` |
| `NEXT_PUBLIC_COLYSEUS_URL` | `wss://<your-service>.onrender.com` — **`wss`**, not `ws` |

Generate a fresh secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Do **not** set `FORCE_IPV4` on Vercel. It's a workaround for this local machine
having no IPv6 route; Vercel's network is fine, and forcing IPv4 there would be
a pointless constraint.

---

## 4. Close the loop between them

Back in Render, set `ALLOWED_ORIGINS` to your Vercel URL
(e.g. `https://futtrade.vercel.app`, no trailing slash) and redeploy.

Colyseus reserves a seat over plain HTTP before upgrading the socket, so the
browser enforces CORS on that first request. Without this, the handshake fails
in production while working perfectly on localhost.

---

## 5. Wire Inngest

1. inngest.com → create an app → **Sync new app**, URL
   `https://<your-app>.vercel.app/api/inngest`.
2. Copy the **Event Key** and **Signing Key** into Vercel as `INNGEST_EVENT_KEY`
   and `INNGEST_SIGNING_KEY`, then redeploy.
3. Confirm `bootstrap-heartbeat` appears in the Functions list.
4. **Wait for a real run.** The cron is `*/15 * * * *` UTC, so within 15 minutes
   a run should appear in the Runs tab. This is the actual exit criterion — a
   scheduler is only proven by a run that happened, not by a function that
   registered.

---

## 6. Verify the whole pipeline

Visit `https://<your-app>.vercel.app/bootstrap`:

- **Auth** — create an account; the panel should show your manager name and email
- **Neon** — "Connected", 4+ public tables, `timescaledb: enabled`
- **Colyseus** — click *Run handshake check*. First attempt may take ~50s if the
  Render service is asleep; it should end with "Connected and message
  round-tripped"
- **Inngest** — confirmed in the dashboard, per step 5

When all four pass in production, Phase 00 is complete and Phase 01
(Tick Loop Skeleton) is unblocked.

---

## Local development

```bash
npm install && npm --prefix server install

npm run db:migrate     # apply migrations to Neon
npm run server:dev     # Colyseus on :2567
npm run dev            # Next.js on :3000
npm run inngest:dev    # optional: Inngest dev server on :8288
```

`INNGEST_DEV=1` makes the app talk to the local Inngest dev server instead of
Inngest cloud. Without it, `/api/inngest` reports a missing signing key —
that's expected locally, not a misconfiguration.

### One local quirk worth knowing

This machine has no IPv6 default route, but Neon's DNS returns AAAA records.
Node races an IPv6 connection that fails with `ENETUNREACH`, so Neon queries
fail *intermittently* — which is far more confusing than failing every time.
`FORCE_IPV4=1` in `.env` fixes it. Check whether you still need it with:

```bash
ip -6 route show default   # no output = keep FORCE_IPV4=1
```

Separately, Neon's compute suspends when idle, so the first query after a quiet
period can be slow or time out while it wakes. `npm run db:migrate` retries
three times for exactly this reason.
