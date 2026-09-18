import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { runMigrations } from "@/lib/db/migrate";

export async function setup() {
  const testUrl = process.env.DATABASE_URL_TEST;
  const adminUrl = process.env.DATABASE_URL_ADMIN;
  if (!testUrl || !adminUrl) {
    throw new Error("DATABASE_URL_TEST and DATABASE_URL_ADMIN must be set — check .env.local.");
  }

  const testDbName = new URL(testUrl).pathname.replace(/^\//, "");
  if (!testDbName) {
    throw new Error(`Could not determine a database name from DATABASE_URL_TEST (${testUrl}).`);
  }

  // supabase/migrations/*.sql isn't idempotent on its own (no applied-
  // migrations tracking, unlike the main DB's supabase_migrations
  // table) — so each test run starts the throwaway test database from a
  // clean slate rather than trying to re-apply on top of a stale one.
  const admin = postgres(adminUrl, { max: 1 });
  try {
    await admin.unsafe(`drop database if exists "${testDbName}"`);
    await admin.unsafe(`create database "${testDbName}"`);
  } finally {
    await admin.end();
  }

  await runMigrations(testUrl);

  // Same seed source Supabase CLI runs automatically for the main DB
  // (supabase/seed.sql) — applied here too so both databases start from
  // the same reference data (e.g. the roles table).
  const seedSql = await readFile(path.join(process.cwd(), "supabase", "seed.sql"), "utf8");
  const testClient = postgres(testUrl, { max: 1 });
  try {
    await testClient.unsafe(seedSql);
  } finally {
    await testClient.end();
  }
}
