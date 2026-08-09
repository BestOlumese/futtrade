import {
  passAccuracy,
  possessionPercent,
  type SideTotals,
} from "@/lib/match/derive";

/**
 * The team stat card. Every row is a count or a sum over `match_event` — there
 * is no second data path behind any number here, which is the Phase 05 exit
 * criterion in its plainest form.
 *
 * Each row carries a split bar as well as its digits, so the shape of the match
 * is readable before any number is. Numbers are JetBrains Mono with tabular
 * figures throughout, per the design system.
 */

type Row = {
  label: string;
  home: string;
  away: string;
  /** Home's share of the row, 0–1, for the split bar. Omitted where meaningless. */
  share?: number;
};

function shareOf(home: number, away: number): number {
  const total = home + away;
  return total === 0 ? 0.5 : home / total;
}

export function StatCard({
  home,
  away,
  homeName,
  awayName,
}: {
  home: SideTotals;
  away: SideTotals;
  homeName: string;
  awayName: string;
}) {
  const possession = possessionPercent(home, away);

  const rows: Row[] = [
    {
      label: "Possession",
      home: `${possession}%`,
      away: `${100 - possession}%`,
      share: possession / 100,
    },
    {
      label: "Shots (on target)",
      home: `${home.shots} (${home.onTarget})`,
      away: `${away.shots} (${away.onTarget})`,
      share: shareOf(home.shots, away.shots),
    },
    {
      label: "xG",
      home: home.xg.toFixed(2),
      away: away.xg.toFixed(2),
      share: shareOf(home.xg, away.xg),
    },
    {
      label: "Pass accuracy",
      home: `${passAccuracy(home)}%`,
      away: `${passAccuracy(away)}%`,
      share: shareOf(passAccuracy(home), passAccuracy(away)),
    },
    {
      label: "Tackles",
      home: `${home.tackles}`,
      away: `${away.tackles}`,
      share: shareOf(home.tackles, away.tackles),
    },
    {
      label: "Fouls",
      home: `${home.fouls}`,
      away: `${away.fouls}`,
      share: shareOf(home.fouls, away.fouls),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label truncate text-lime">{homeName}</span>
        <span className="label truncate text-right text-floodlight">{awayName}</span>
      </div>

      <dl className="flex flex-col gap-3.5">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <dd className="numeric text-sm text-floodlight">{row.home}</dd>
              <dt className="label text-mute">{row.label}</dt>
              <dd className="numeric text-sm text-floodlight">{row.away}</dd>
            </div>
            {row.share !== undefined && (
              <div className="flex h-[3px] gap-px" aria-hidden>
                <span
                  className="bg-lime"
                  style={{ width: `${row.share * 100}%` }}
                />
                <span className="flex-1 bg-floodlight/45" />
              </div>
            )}
          </div>
        ))}

        {/* Cards get their own row: they are objects with colours, not a ratio,
            and a split bar between two bookings would be meaningless. */}
        <div className="flex items-baseline justify-between gap-3 border-t border-steel/25 pt-3.5">
          <Cards yellows={home.yellows} reds={home.reds} />
          <dt className="label text-mute">Cards</dt>
          <Cards yellows={away.yellows} reds={away.reds} />
        </div>
      </dl>
    </div>
  );
}

function Cards({ yellows, reds }: { yellows: number; reds: number }) {
  if (yellows === 0 && reds === 0) {
    return <dd className="numeric text-sm text-mute">—</dd>;
  }
  return (
    <dd className="flex items-center gap-2">
      {yellows > 0 && (
        <span className="flex items-center gap-1">
          {/* card-yellow is the colour of a real object, never an accent. */}
          <span className="h-3 w-[9px] bg-card-yellow" aria-hidden />
          <span className="numeric text-sm text-floodlight">{yellows}</span>
        </span>
      )}
      {reds > 0 && (
        <span className="flex items-center gap-1">
          <span className="h-3 w-[9px] bg-live" aria-hidden />
          <span className="numeric text-sm text-floodlight">{reds}</span>
        </span>
      )}
      <span className="sr-only">
        {yellows} yellow, {reds} red
      </span>
    </dd>
  );
}
