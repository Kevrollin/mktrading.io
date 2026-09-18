import { date, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/users";

// Split from `users` deliberately: this table can grow with KYC-era fields
// later without ever touching the auth-critical users table.
export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  country: text("country").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }).notNull(),
  riskDisclosureAcceptedAt: timestamp("risk_disclosure_accepted_at", {
    withTimezone: true,
  }).notNull(),
});
