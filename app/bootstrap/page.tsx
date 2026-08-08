import { headers } from "next/headers";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Atmosphere } from "@/components/atmosphere/atmosphere";
import { Panel } from "@/components/ui/panel";
import { ColyseusCheck } from "@/components/bootstrap/colyseus-check";
import { mailStatus, verifyMailConnection } from "@/lib/mail";
import { secretFingerprint } from "@/lib/match-ticket";

export const dynamic = "force-dynamic";

/**
 * Phase 00 exit criteria, made visible.
 *
 * A working surface, so it gets the quiet atmosphere only — wash and grain, no
 * beams or grid. Scaffolding, not product: delete it once Phase 01 has a real
 * match surface.
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

function StatusRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad" | "neutral";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-steel/20 py-2 last:border-0">
      <span className="label text-mute">{label}</span>
      <span
        className={`numeric truncate text-xs ${
          tone === "ok"
            ? "text-lime"
            : tone === "bad"
              ? "text-live"
              : "text-floodlight"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default async function BootstrapPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  const database = await checkDatabase();
  const mail = mailStatus();
  const ticketFingerprint = secretFingerprint();
  // Only worth a live SMTP handshake if the credentials are even present.
  const mailConn = mail.configured
    ? await verifyMailConnection()
    : { ok: false, detail: `missing ${mail.missing.join(" and ")}` };
  const colyseusEndpoint =
    process.env.NEXT_PUBLIC_COLYSEUS_URL ?? "ws://localhost:2567";

  return (
    <>
      <Atmosphere variant="quiet" />

      <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-3">
          <span className="label text-lime">Phase 00</span>
          <h1 className="display-xl text-floodlight">Bootstrap status</h1>
          <p className="max-w-xl font-sans text-sm leading-relaxed text-floodlight/50">
            Every piece of infrastructure, proven to be talking to every other
            piece. Scaffolding — this page goes away in Phase 01.
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          <Panel bodyClassName="p-5 flex flex-col gap-3">
            <h2 className="display-md text-floodlight">Auth</h2>
            {session?.user ? (
              <div className="flex flex-col">
                <StatusRow label="State" value="Signed in" tone="ok" />
                <StatusRow label="Manager" value={session.user.name} />
                <StatusRow label="Email" value={session.user.email} />
              </div>
            ) : (
              <>
                <p className="font-sans text-sm text-floodlight/60">
                  Not signed in.
                </p>
                <Link
                  href="/sign-up"
                  className="mt-auto font-sans text-sm text-lime underline-offset-4 hover:underline"
                >
                  Create an account →
                </Link>
              </>
            )}
          </Panel>

          <Panel bodyClassName="p-5 flex flex-col gap-3">
            <h2 className="display-md text-floodlight">Neon</h2>
            {database.ok ? (
              <div className="flex flex-col">
                <StatusRow label="State" value="Connected" tone="ok" />
                <StatusRow
                  label="Public tables"
                  value={String(database.tables)}
                />
                <StatusRow
                  label="timescaledb"
                  value={database.hasTimescale ? "enabled" : "missing"}
                  tone={database.hasTimescale ? "ok" : "bad"}
                />
              </div>
            ) : (
              <p className="font-sans text-sm text-live">{database.message}</p>
            )}
          </Panel>

          <ColyseusCheck endpoint={colyseusEndpoint} />

          <Panel bodyClassName="p-5 flex flex-col gap-3">
            <h2 className="display-md text-floodlight">Mail</h2>
            <div className="flex flex-col">
              <StatusRow
                label="Credentials"
                value={mail.configured ? "set" : "MISSING"}
                tone={mail.configured ? "ok" : "bad"}
              />
              <StatusRow label="Sender" value={mail.sender ?? "—"} />
              <StatusRow
                label="SMTP"
                value={mailConn.ok ? "authenticated" : "failed"}
                tone={mailConn.ok ? "ok" : "bad"}
              />
            </div>
            {!mailConn.ok && (
              <p className="font-sans text-xs leading-relaxed text-live">
                {mailConn.detail}
              </p>
            )}
            <p className="mt-auto font-sans text-xs leading-relaxed text-floodlight/45">
              Without this, sign-up still returns 200 but the verification link
              is only written to the server log — and nobody can ever sign in,
              because verification is required.
            </p>
          </Panel>

          <Panel bodyClassName="p-5 flex flex-col gap-3">
            <h2 className="display-md text-floodlight">Match tickets</h2>
            <div className="flex flex-col">
              <StatusRow
                label="Secret"
                value={ticketFingerprint ? "set" : "MISSING"}
                tone={ticketFingerprint ? "ok" : "bad"}
              />
              <StatusRow label="Fingerprint" value={ticketFingerprint ?? "—"} />
            </div>
            <p className="mt-auto font-sans text-xs leading-relaxed text-floodlight/45">
              Compare this with <span className="numeric">ticketSecret</span> on
              the match server&apos;s <span className="numeric">/healthz</span>.
              The two must be identical, or a join fails however correct
              everything else looks.
            </p>
          </Panel>

          <Panel bodyClassName="p-5 flex flex-col gap-3">
            <h2 className="display-md text-floodlight">Inngest</h2>
            <p className="font-sans text-sm leading-relaxed text-floodlight/60">
              <span className="numeric text-xs text-floodlight">
                bootstrap-heartbeat
              </span>{" "}
              runs every 15 minutes (UTC). Confirm it in the Inngest dashboard —
              a scheduler is only proven by a run that actually happened.
            </p>
            <p className="numeric mt-auto text-xs text-mute">/api/inngest</p>
          </Panel>
        </div>
      </main>
    </>
  );
}
