import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import type { MatchListing } from "@/lib/match/queries";

/**
 * A manager's last few finished matches.
 *
 * Exists so a match played yesterday is still reachable — without it the
 * summary page is only ever seen in the ninety seconds after full time, which
 * makes it both hard to use and hard to test.
 *
 * Scores read from the manager's own side, so "2-1" always means they won.
 * Presenting home-first would make a reader work out which team they were
 * every single row.
 */
export function RecentMatches({ matches }: { matches: MatchListing[] }) {
  if (matches.length === 0) {
    return (
      <Panel bodyClassName="p-6 flex flex-col gap-2">
        <h2 className="display-md text-floodlight">Recent matches</h2>
        <p className="font-sans text-sm leading-relaxed text-floodlight/45">
          Play a match and it lands here with its full summary.
        </p>
      </Panel>
    );
  }

  return (
    <Panel bodyClassName="p-6 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="display-md text-floodlight">Recent matches</h2>
        <span className="label text-mute">{matches.length} shown</span>
      </div>

      <ul className="flex flex-col">
        {matches.map((m) => {
          const mine = m.side === "home" ? m.homeScore : m.awayScore;
          const theirs = m.side === "home" ? m.awayScore : m.homeScore;
          const result = mine > theirs ? "won" : mine < theirs ? "lost" : "drew";

          return (
            <li key={m.id} className="border-b border-steel/20 last:border-b-0">
              <Link
                href={`/match/${m.id}`}
                className="group flex items-center gap-4 py-2.5 transition-colors duration-instant hover:bg-surface-2"
              >
                {/* A result needs a word as well as a colour — colour is never
                    the only signal. */}
                <span
                  className={`label w-10 shrink-0 ${
                    result === "won"
                      ? "text-lime"
                      : result === "lost"
                        ? "text-live"
                        : "text-mute"
                  }`}
                >
                  {result === "won" ? "Won" : result === "lost" ? "Lost" : "Drew"}
                </span>
                <span className="numeric shrink-0 text-sm text-floodlight">
                  {mine}
                  <span className="px-1 text-mute">-</span>
                  {theirs}
                </span>
                <span className="min-w-0 flex-1 truncate font-sans text-sm text-floodlight/70">
                  vs {m.opponentName}
                </span>
                <span className="numeric shrink-0 text-xs text-mute">
                  {m.finishedAt
                    ? m.finishedAt.toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"}
                </span>
                <span
                  className="shrink-0 font-sans text-sm text-mute transition-colors duration-instant group-hover:text-lime"
                  aria-hidden
                >
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
