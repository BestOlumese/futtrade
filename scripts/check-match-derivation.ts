import "dotenv/config";
import { forceIpv4IfRequested } from "../lib/force-ipv4";

/**
 * Proves the app's event derivation agrees with the match server's.
 *
 * `lib/match/derive.ts` deliberately mirrors `server/src/sim/events.ts` — the
 * two are separate deployments that share no code, the same way match-ticket.ts
 * and force-ipv4.ts are mirrored. Mirrored code drifts, and a stat card quietly
 * showing a wrong percentage is exactly the kind of drift nobody notices.
 *
 * So they are kept honest by the database rather than by discipline. The match
 * server derived the aggregates on the `match` row from the sim's own state;
 * this recomputes them from that match's events using the APP's implementation
 * and requires them to be equal. If the two ever disagree, this fails.
 *
 *   npm run match:check
 */

async function main() {
  await forceIpv4IfRequested();

  // Imported after the IPv4 guard: the db module opens a pool on first use, and
  // Neon's DNS returns AAAA records this host may have no route to.
  const { getDb } = await import("../lib/db");
  const { match } = await import("../lib/db/schema");
  const { getMatchEvents } = await import("../lib/match/queries");
  const { totalsFrom, possessionPercent } = await import("../lib/match/derive");
  const { eq, desc } = await import("drizzle-orm");

  const db = getDb();
  const finished = await db
    .select()
    .from(match)
    .where(eq(match.status, "finished"))
    .orderBy(desc(match.finishedAt))
    .limit(25);

  if (finished.length === 0) {
    console.log(
      "\nNo finished matches to check.\n" +
        "Play one — `npm --prefix server run events:e2e` — then run this again.\n",
    );
    return;
  }

  console.log(`\nChecking ${finished.length} finished matches\n`);

  const failures: string[] = [];
  let checked = 0;
  let skipped = 0;

  for (const row of finished) {
    const events = await getMatchEvents(row.id);
    if (events.length === 0) {
      // A match from before Phase 04 has a result but no log. Not a failure —
      // there is simply nothing to derive from.
      skipped++;
      continue;
    }
    checked++;

    const home = totalsFrom(events, "home");
    const away = totalsFrom(events, "away");
    const derivedPossession = possessionPercent(home, away);

    const problems: string[] = [];
    const same = (name: string, derived: number, stored: number, tol = 0) => {
      if (Math.abs(derived - stored) > tol) {
        problems.push(`${name} ${derived} vs stored ${stored}`);
      }
    };

    same("home score", home.goals, row.homeScore);
    same("away score", away.goals, row.awayScore);
    same("home shots", home.shots, row.homeShots);
    same("away shots", away.shots, row.awayShots);
    // xG is stored as `real` (float32) after being summed in float64.
    same("home xG", round2(home.xg), round2(row.homeXg), 0.02);
    same("away xG", round2(away.xg), round2(row.awayXg), 0.02);
    // The one that matters most: possession is pass share on both sides of the
    // mirror, so it should be exactly equal, not merely close.
    same("possession", derivedPossession, row.homePossession);

    const label = `${row.id.slice(0, 8)} ${row.homeScore}-${row.awayScore}`;
    if (problems.length) {
      failures.push(`${label}: ${problems.join("; ")}`);
      console.log(`  FAIL  ${label} — ${problems.join("; ")}`);
    } else {
      console.log(
        `  OK    ${label}  ${events.length} events · ` +
          `${derivedPossession}% possession · xG ${round2(home.xg)}–${round2(away.xg)}`,
      );
    }
  }

  console.log(
    `\n${checked - failures.length}/${checked} matches derive correctly` +
      (skipped ? `  (${skipped} pre-Phase-04 matches have no log, skipped)` : ""),
  );
  if (failures.length) {
    console.log(
      "\nThe app's derivation and the match server's have DRIFTED. Both\n" +
        "implementations are listed in lib/match/derive.ts's header comment.\n",
    );
  }
  process.exit(failures.length ? 1 : 0);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

void main();
