import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

/**
 * Applies every supabase/migrations/*.sql file, in filename (timestamp)
 * order, to the given database.
 *
 * The Supabase CLI (`supabase db reset` / `supabase start`) is the
 * canonical way these migrations get applied to the main local/hosted
 * database, tracked in its own `supabase_migrations.schema_migrations`
 * table. This plain runner exists only for the *separate*
 * `mktrading_test` database used by the Vitest suite — a second database
 * on the same local Postgres server that the Supabase CLI has no concept
 * of, so it needs its own equally simple apply step. It tracks nothing
 * and is not idempotent by itself; callers that need idempotency (see
 * test-global-setup.ts) are responsible for that.
 */
export async function runMigrations(connectionString: string) {
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();

  const prepare = process.env.DATABASE_DISABLE_PREPARE !== "true";
  const client = postgres(connectionString, { max: 1, prepare });

  try {
    for (const file of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.unsafe(sql);
    }
  } finally {
    await client.end();
  }
}
