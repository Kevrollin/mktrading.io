import { boolean, pgTable, smallint, text } from "drizzle-orm/pg-core";

export const currencyKindValues = ["FIAT", "CRYPTO"] as const;
export type CurrencyKind = (typeof currencyKindValues)[number];

// Reference data only — drives input-boundary validation (how many
// decimal places this currency accepts) and display. Never storage
// precision: every ledger amount is stored as numeric(38,18) regardless
// of currency (see lib/db/schema/ledger.ts).
export const currencies = pgTable("currencies", {
  code: text("code").primaryKey(), // 'KES', 'USD', 'BTC', 'USDT', 'USDC'
  name: text("name").notNull(),
  kind: text("kind", { enum: currencyKindValues }).notNull(),
  decimals: smallint("decimals").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});
