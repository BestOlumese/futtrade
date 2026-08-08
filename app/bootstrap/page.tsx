import { headers } from "next/headers";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { ColyseusCheck } from "@/components/bootstrap/colyseus-check";

export const dynamic = "force-dynamic";

/**
 * Phase 00 exit criteria, made visible.
 *
 * This page is the proof that the pipeline works end to end — auth against
 * Neon, the timescaledb extension present, and a WebSocket round trip to the
 * Colyseus service. It is scaffolding, not product: delete it once Phase 01
 * has a real match surface.
 */

async function checkDatabase() {
  try {
    const db = getDb();
    const { rows } = await db.execute<{
      has_timescale: boolean;
      table_count: number;
    }>(sql`
      select
        exists(select 1 from pg_extension where extname = 'timescaledb') as has_timescale,
        (select count(*)::int from information_schema.tables
          where table_schema = 'public') as table_count
    `);
    const row = rows[0];
    return {
      ok: true as const,
      hasTimescale: row.has_timescale,
      tables: row.table_count,
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export default async function BootstrapPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  const database = await checkDatabase();

  const colyseusEndpoint =
    process.env.NEXT_PUBLIC_COLYSEUS_URL ?? "ws://localhost:2567";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <p className="eyebrow text-signal">
          Phase 00
        </p>
        <h1 className="display-lg text-floodlight">
          Bootstrap status
        </h1>
        <p className="font-sans text-sm text-floodlight/55">
          Every piece of infrastructure, proven to be talking to every other
          piece. Scaffolding — this page goes away in Phase 01.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        <Panel>
          <div className="flex flex-col gap-3 p-6">
            <h2 className="display-sm text-floodlight">
              Auth
            </h2>
            {session?.user ? (
              <>
                <p className="font-sans text-sm text-signal">Signed in.</p>
                <dl className="flex flex-col gap-1 numeric text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-floodlight/45">Manager</dt>
                    <dd className="truncate text-floodlight">
                      {session.user.name}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-floodlight/45">Email</dt>
                    <dd className="truncate text-floodlight">
                      {session.user.email}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <p className="font-sans text-sm text-floodlight/70">
                  Not signed in.
                </p>
                <Link
                  href="/sign-up"
                  className="font-sans text-sm text-signal underline-offset-4 hover:underline"
                >
                  Create an account
                </Link>
              </>
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-col gap-3 p-6">
            <h2 className="display-sm text-floodlight">
              Neon
            </h2>
            {database.ok ? (
              <>
                <p className="font-sans text-sm text-signal">Connected.</p>
                <dl className="flex flex-col gap-1 numeric text-sm">
                  <div className="flex justify-between">
                    <dt className="text-floodlight/45">Public tables</dt>
                    <dd className="text-floodlight">{database.tables}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-floodlight/45">timescaledb</dt>
                    <dd
                      className={
                        database.hasTimescale ? "text-signal" : "text-tally"
                      }
                    >
                      {database.hasTimescale ? "enabled" : "missing"}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="font-sans text-sm text-tally">{database.message}</p>
            )}
          </div>
        </Panel>

        <ColyseusCheck endpoint={colyseusEndpoint} />

        <Panel>
          <div className="flex flex-col gap-3 p-6">
            <h2 className="display-sm text-floodlight">
              Inngest
            </h2>
            <p className="font-sans text-sm text-floodlight/70">
              The <span className="font-mono">bootstrap-heartbeat</span> function
              runs every 15 minutes (UTC). Confirm it in the Inngest dashboard —
              a scheduler is only proven by a run that actually happened.
            </p>
            <p className="numeric text-xs text-floodlight/45">/api/inngest</p>
          </div>
        </Panel>
      </div>
    </main>
  );
}
