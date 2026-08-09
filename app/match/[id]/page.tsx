import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Atmosphere } from "@/components/atmosphere/atmosphere";
import { Panel } from "@/components/ui/panel";
import { ButtonLink } from "@/components/ui/button";
import { getMatch, getMatchEvents } from "@/lib/match/queries";
import {
  keyMoments,
  playerLines,
  shotsFrom,
  totalsFrom,
  xgRace,
} from "@/lib/match/derive";
import { ShotMap } from "@/components/match/shot-map";
import { StatCard } from "@/components/match/stat-card";
import { XgRace } from "@/components/match/xg-race";
import { MatchTimeline } from "@/components/match/match-timeline";
import { TopPerformers } from "@/components/match/top-performers";

export const dynamic = "force-dynamic";

/**
 * Phase 05 — the post-match summary.
 *
 * The proof that the event schema supports real UI. Two queries run here: the
 * match row for identity and result, and its event log. EVERY number and every
 * mark below is folded out of that log — the shot map, the stat card, the xG
 * race, the timeline and the player lines all come from the same array. There
 * is no second data path on this page, which is the phase's exit criterion.
 *
 * A working surface, so it takes the quiet atmosphere: wash and grain, no beams
 * or glow behind data.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const record = await getMatch((await params).id).catch(() => null);
  if (!record) return { title: "Match — FUTTRADE" };
  return {
    title: `${record.homeName} ${record.homeScore}-${record.awayScore} ${record.awayName} — FUTTRADE`,
    description: "Post-match summary, derived entirely from the match event stream.",
  };
}

export default async function MatchSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  if (!session?.user) redirect(`/sign-in?next=/match/${id}`);

  const record = await getMatch(id);
  if (!record) notFound();

  // A live match belongs in the room, not in a summary — its log is still being
  // written. An abandoned one has no result worth presenting as one.
  if (record.status !== "finished") {
    return (
      <>
        <Atmosphere variant="quiet" />
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
          <Panel bodyClassName="p-6 flex flex-col gap-4">
            <span className="label text-mute">
              {record.status === "live" ? "In progress" : "Abandoned"}
            </span>
            <h1 className="display-md text-floodlight">
              {record.status === "live"
                ? "This match hasn't finished"
                : "This match was abandoned"}
            </h1>
            <p className="font-sans text-sm leading-relaxed text-floodlight/55">
              {record.status === "live"
                ? "Its event log is still being written. The summary is built once the whistle goes."
                : "The room closed before full time, so there is no result to show. The events it did produce are still on record."}
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/match">Match room</ButtonLink>
            </div>
          </Panel>
        </main>
      </>
    );
  }

  const events = await getMatchEvents(id);

  const home = totalsFrom(events, "home");
  const away = totalsFrom(events, "away");
  const shots = shotsFrom(events);
  const race = xgRace(events);
  const moments = keyMoments(events);

  return (
    <>
      <Atmosphere variant="quiet" />

      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-12">
        <Scoreboard record={record} />

        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <Panel bodyClassName="p-6 flex flex-col gap-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="display-md text-floodlight">Shot map</h2>
              <span className="label text-mute">Both sides, one goal</span>
            </div>
            <ShotMap
              shots={shots}
              homeName={record.homeName}
              awayName={record.awayName}
            />
          </Panel>

          {/* The stat card is short and the shot map is tall, so the timeline
              rides along in this column — otherwise the right half of the page
              is a large empty rectangle. */}
          <div className="flex flex-col gap-6">
            <Panel bodyClassName="p-6">
              <StatCard
                home={home}
                away={away}
                homeName={record.homeName}
                awayName={record.awayName}
              />
            </Panel>

            <Panel bodyClassName="p-6 flex flex-col gap-4">
              <h2 className="display-md text-floodlight">Timeline</h2>
              <MatchTimeline
                moments={moments}
                homeName={record.homeName}
                awayName={record.awayName}
              />
            </Panel>
          </div>
        </div>

        <Panel bodyClassName="p-6 flex flex-col gap-5">
          <h2 className="display-md text-floodlight">xG race</h2>
          <XgRace
            data={race}
            homeName={record.homeName}
            awayName={record.awayName}
          />
        </Panel>

        <div className="grid gap-6">
          <Panel bodyClassName="p-6 flex flex-col gap-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="display-md text-floodlight">Who did what</h2>
              <span className="label text-mute">By shirt</span>
            </div>
            <TopPerformers
              home={playerLines(events, "home")}
              away={playerLines(events, "away")}
              homeName={record.homeName}
              awayName={record.awayName}
            />
          </Panel>
        </div>

        <p className="font-sans text-xs leading-relaxed text-floodlight/40">
          Every figure on this page is derived from the {events.length} events in
          this match&rsquo;s log — nothing here reads a second table.{" "}
          <Link
            href="/match"
            className="text-lime underline-offset-4 hover:underline"
          >
            Back to the match room
          </Link>
        </p>
      </main>
    </>
  );
}

function Scoreboard({
  record,
}: {
  record: Awaited<ReturnType<typeof getMatch>> & object;
}) {
  const kickoff = record.startedAt.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    // A full-width broadcast bar, not a card — so no panel treatment on it, per
    // docs/08-live-match-viewer.md.
    <header className="flex flex-col gap-4 border-b border-steel/30 pb-6">
      <div className="flex items-center justify-between gap-3">
        <span className="label text-mute">Full time</span>
        <span className="numeric text-xs text-mute">{kickoff}</span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Team name={record.homeName} accent align="left" />
        {/* Smaller on narrow screens: at text-5xl the score crowds both names
            into an ellipsis, and a manager's name matters more than the digits
            being enormous. */}
        <div className="numeric shrink-0 text-4xl leading-none text-floodlight sm:text-5xl md:text-6xl">
          {record.homeScore}
          <span className="px-2 text-mute">:</span>
          {record.awayScore}
        </div>
        <Team name={record.awayName} align="right" />
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="font-sans text-xs capitalize text-mute">
          {record.homeMentality} / {record.homePressing}
        </span>
        <span className="font-sans text-xs capitalize text-mute">
          {record.awayMentality} / {record.awayPressing}
        </span>
      </div>
    </header>
  );
}

function Team({
  name,
  accent = false,
  align,
}: {
  name: string;
  accent?: boolean;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col gap-1 ${align === "right" ? "items-end text-right" : ""}`}
    >
      <span className={`label ${accent ? "text-lime" : "text-mute"}`}>
        {accent ? "Home" : "Away"}
      </span>
      <span className="truncate font-display text-base text-floodlight sm:text-lg md:text-xl">
        {name}
      </span>
    </div>
  );
}
