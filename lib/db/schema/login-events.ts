import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/users";

export const loginFailureReasonValues = [
  "no_such_account",
  "bad_password",
  "mfa_failed",
  "rate_limited",
  "account_restricted",
] as const;
export type LoginFailureReason = (typeof loginFailureReasonValues)[number];

// Doubles as the user-facing "login activity" feed and fraud-investigation
// data. failureReason stays precise internally — the HTTP response and its
// timing always collapse to one generic message externally.
export const loginEvents = pgTable(
  "login_events",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Nullable: a failed attempt against a nonexistent account still logs,
    // just without a user to attach to.
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    identifier: text("identifier").notNull(),
    success: boolean("success").notNull(),
    failureReason: text("failure_reason", { enum: loginFailureReasonValues }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("login_events_user_id_idx").on(table.userId)],
);
