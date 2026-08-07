import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { schema } from "./schema";

/**
 * Neon connection for the Next.js app.
 *
 * Uses the WebSocket-backed `Pool` (not the HTTP driver) because Better Auth
 * runs multi-statement writes inside transactions, which the HTTP driver
 * cannot do.
 *
 * Built lazily so that importing this module never fails a build when
 * DATABASE_URL is absent — the error surfaces at first query instead, with a
 * message that says what to do.
 */

let pool: Pool | undefined;
let db: NeonDatabase<typeof schema> | undefined;

export function getDb(): NeonDatabase<typeof schema> {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Copy the pooled connection string from the Neon dashboard into .env",
      );
    }
    pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });
  }
  return db;
}

export { schema };
