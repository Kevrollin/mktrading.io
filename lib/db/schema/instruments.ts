import { boolean, numeric, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/users";

// Ids/symbols/names deliberately reuse lib/demo-markets.ts (the
// Milestone 1 marketing placeholder data) for continuity — the two are
// independent sources of truth, not synced. Editing one never touches
// the other; see the matching comment in lib/demo-markets.ts.
export const instrumentCategoryValues = ["rapid", "standard", "range-bound"] as const;
export type InstrumentCategory = (typeof instrumentCategoryValues)[number];

export const instruments = pgTable("instruments", {
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  category: text("category", { enum: instrumentCategoryValues }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  // e.g. 85.00 = 85% profit on a winning stake.
  payoutPercent: numeric("payout_percent", { precision: 5, scale: 2 }).notNull(),
  allowedDurationsSeconds: smallint("allowed_durations_seconds").array().notNull(),
  minStake: numeric("min_stake", { precision: 38, scale: 18 }),
  maxStake: numeric("max_stake", { precision: 38, scale: 18 }),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
