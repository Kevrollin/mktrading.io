import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { currencies } from "@/lib/db/schema/currencies";
import { users } from "@/lib/db/schema/users";

// The platform's own receiving address per crypto currency — where real
// customer deposits would actually land. Distinct from ledger_accounts'
// TREASURY row (an internal accounting bucket with no real-world
// address). SUPER_ADMIN-only to view or change: pasting the wrong
// address here would misdirect real deposits.
export const platformWallets = pgTable("platform_wallets", {
  currency: text("currency")
    .primaryKey()
    .references(() => currencies.code),
  address: text("address"),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
