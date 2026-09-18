import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

declare global {
  var __dbClient: ReturnType<typeof createClient> | undefined;
}

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }
  // Set DATABASE_DISABLE_PREPARE=true when DATABASE_URL points at a
  // connection-pooled endpoint (e.g. Supabase's pooled/Supavisor
  // transaction-mode port, or any PgBouncer in transaction mode) — those
  // don't support prepared statements, which postgres.js uses by default.
  // A direct connection (this project's local Docker Postgres today, or
  // Supabase's direct/non-pooled port later) doesn't need this.
  const prepare = process.env.DATABASE_DISABLE_PREPARE !== "true";
  const queryClient = postgres(connectionString, { prepare });
  return drizzle(queryClient, { schema });
}

// Cached on globalThis in development so Next's hot-reload doesn't open a
// fresh connection pool on every reload.
export const db = globalThis.__dbClient ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__dbClient = db;
}
