# Futtrade

An online football club-management game: tactics and squad management, live
matchmade 1v1 matches with a 2D match center, and a two-sided player-share
market whose prices move off real match performance.

- **What to read first:** [AGENTS.md](AGENTS.md) — what this is, how the docs
  are organized, and the non-negotiables.
- **Where the build is:** [docs/phases/README.md](docs/phases/README.md)
  (currently Phase 00 — Bootstrap).
- **How to deploy:** [DEPLOY.md](DEPLOY.md).

## Layout

```
app/          Next.js App Router — the app shell
components/   UI built on the design tokens in docs/04-design-system.md
lib/          db (Drizzle + Neon), auth (Better Auth), inngest (scheduling)
drizzle/      generated SQL migrations
scripts/      migrate.ts
server/       Colyseus match server — separate service, own package.json,
              deployed as a container, never serverless
docs/         phases, concerns, feature specs, design specs
```

## Local development

```bash
npm install && npm --prefix server install

npm run db:migrate     # apply migrations to Neon
npm run server:dev     # Colyseus on :2567
npm run dev            # Next.js on :3000
```

Then open [localhost:3000/bootstrap](http://localhost:3000/bootstrap) — it shows
the live status of auth, Neon, `timescaledb`, Colyseus and Inngest.

Copy the environment template from the comments in `.env` (gitignored); see
[DEPLOY.md](DEPLOY.md) for what each variable is and where to get it.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration from `lib/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Drizzle Studio |
| `npm run server:dev` | Colyseus server, watch mode |
| `npm run inngest:dev` | Inngest dev server on :8288 |
