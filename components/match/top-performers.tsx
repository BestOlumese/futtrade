import type { PlayerLine, Side } from "@/lib/match/derive";

/**
 * Who actually did something, per side.
 *
 * Keyed by shirt number, because that is the identifier the event stream carries
 * until Phase 09 brings real squads. Phase 10 fills `player_id` in alongside the
 * shirt rather than replacing it, so this component gets a name where it
 * currently prints `#9` and nothing else changes. That continuity is the reason
 * events carry both.
 *
 * Four lines a side, not eleven: a 30-tick match leaves most of the team with an
 * empty row, and a table of zeroes undersells the data rather than proving it.
 */
const SHOWN = 4;

export function TopPerformers({
  home,
  away,
  homeName,
  awayName,
}: {
  home: PlayerLine[];
  away: PlayerLine[];
  homeName: string;
  awayName: string;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Column side="home" name={homeName} lines={home} />
      <Column side="away" name={awayName} lines={away} />
    </div>
  );
}

function Column({
  side,
  name,
  lines,
}: {
  side: Side;
  name: string;
  lines: PlayerLine[];
}) {
  // Someone who only misplaced a pass isn't a performer. A player earns a row by
  // shooting, tackling or being booked.
  const shown = lines
    .filter((l) => l.shots > 0 || l.tackles > 0 || l.yellows > 0 || l.reds > 0)
    .slice(0, SHOWN);

  return (
    <div className="flex flex-col gap-2">
      <span className={`label truncate ${side === "home" ? "text-lime" : "text-floodlight"}`}>
        {name}
      </span>

      {shown.length === 0 ? (
        <p className="font-sans text-xs text-floodlight/40">Nothing to report.</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((line) => (
            <li
              key={line.shirt}
              className="flex items-baseline justify-between gap-3 border-b border-steel/20 py-1.5 last:border-b-0"
            >
              <span className="flex items-baseline gap-2">
                <span
                  className={`numeric text-sm ${side === "home" ? "text-lime" : "text-floodlight"}`}
                >
                  #{line.shirt}
                </span>
                {line.yellows > 0 && (
                  <span className="h-2.5 w-[7px] bg-card-yellow" role="img" aria-label="Booked" />
                )}
                {line.reds > 0 && (
                  <span className="h-2.5 w-[7px] bg-live" role="img" aria-label="Sent off" />
                )}
              </span>
              <span className="font-sans text-xs text-mute">{describe(line)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Plain words in the order a reader cares about them, not a row of columns. */
function describe(line: PlayerLine): string {
  const parts: string[] = [];
  if (line.goals > 0) parts.push(line.goals === 1 ? "1 goal" : `${line.goals} goals`);
  if (line.assists > 0) parts.push(`${line.assists} assist${line.assists > 1 ? "s" : ""}`);
  if (line.shots > 0) parts.push(`${line.shots} shot${line.shots > 1 ? "s" : ""}`);
  if (line.tackles > 0)
    parts.push(`${line.tackles} tackle${line.tackles > 1 ? "s" : ""}`);
  // xG earns its place only where it says something the counts don't — a player
  // with good chances who didn't score.
  if (line.shots > 0 && line.goals === 0 && line.xg >= 0.25) {
    parts.push(`${line.xg.toFixed(2)} xG`);
  }
  return parts.join(" · ");
}
