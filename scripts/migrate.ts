import "dotenv/config";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { forceIpv4IfRequested } from "../lib/force-ipv4";

/**
 * Applies pending migrations from ./drizzle.
 *
 * Used instead of `drizzle-kit migrate` so that the FORCE_IPV4 guard and a
 * cold-start retry both apply — Neon's compute suspends when idle, and the
 * first connection after a suspension can time out while it wakes.
 */

forceIpv4IfRequested();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Fill it in .env — see DEPLOY.md.");
  process.exit(1);
}

const ATTEMPTS = 3;

async function run(): Promise<void> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const pool = new Pool({ connectionString });
    try {
      await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
      console.log("Migrations applied.");
      await pool.end();
      return;
    } catch (error) {
      await pool.end().catch(() => {});
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === ATTEMPTS) {
        console.error(`Migration failed after ${ATTEMPTS} attempts:`, message);
        process.exit(1);
      }
      console.warn(
        `Attempt ${attempt} failed (${message}). Neon may be waking from scale-to-zero; retrying…`,
      );
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
    }
  }
}

void run();
