import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

// Incremented via one atomic `INSERT ... ON CONFLICT (key, window_start) DO
// UPDATE SET count = count + 1 RETURNING count` — never read-then-write,
// which has a TOCTOU race that's exploitable by concurrent requests.
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.key, table.windowStart] })],
);
