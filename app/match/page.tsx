import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Atmosphere } from "@/components/atmosphere/atmosphere";
import { Panel } from "@/components/ui/panel";
import { ButtonLink } from "@/components/ui/button";
import { MatchRoomPanel } from "@/components/match/match-room";
import { RecentMatches } from "@/components/match/recent-matches";
import { listRecentMatches } from "@/lib/match/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Match — FUTTRADE",
  description: "The live match room.",
};

/**
 * Phases 01–05 — the match room, and the way back to matches already played.
 *
 * A working surface, so it takes the quiet atmosphere: wash and grain, no beams
 * or glow behind data. This page grows into the real match centre in Phase 02
 * onward; today it proves one thing, that the server owns the clock and both
 * clients agree on it.
 */
export default async function MatchPage() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  // Phase 05: without a list, the post-match summary is only reachable in the
  // ninety seconds after full time.
  const recent = session?.user
    ? await listRecentMatches(session.user.id).catch(() => [])
    : [];

  return (
    <>
      <Atmosphere variant="quiet" />

      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-3">
          <span className="label text-lime">Phase 05</span>
          <h1 className="display-xl text-floodlight">Match room</h1>
          <p className="max-w-xl font-sans text-sm leading-relaxed text-floodlight/50">
            Two managers, two dials, ninety minutes in ninety seconds. The
            server owns the clock and the score; your dials are intent it
            chooses to honour.
          </p>
        </header>

        {session?.user ? (
          <>
            <MatchRoomPanel />
            <RecentMatches matches={recent} />
          </>
        ) : (
          <Panel bodyClassName="p-6 flex flex-col gap-4">
            <h2 className="display-md text-floodlight">Sign in to join</h2>
            <p className="font-sans text-sm leading-relaxed text-floodlight/55">
              A seat in a match room is tied to your account, so the server knows
              which manager is which — and so a reconnection means the same
              person is back, not merely the same browser tab.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/sign-in">Sign in</ButtonLink>
              <ButtonLink href="/sign-up" variant="secondary">
                Create account
              </ButtonLink>
            </div>
          </Panel>
        )}

        <p className="font-sans text-xs text-floodlight/40">
          Open this page in a second browser to see both clients on the same
          tick.{" "}
          <Link
            href="/bootstrap"
            className="text-lime underline-offset-4 hover:underline"
          >
            Infrastructure status
          </Link>
        </p>
      </main>
    </>
  );
}
