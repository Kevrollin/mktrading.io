import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/users";

export const notificationTypeValues = [
  "account_created",
  "email_verified",
  "security_alert",
  "password_changed",
  "new_login",
] as const;
export type NotificationType = (typeof notificationTypeValues)[number];

// Doubles as the dev-mode "email outbox": the dev EmailProvider writes the
// rendered body/link straight into `payload` instead of calling a real
// provider, readable via the dev-only inbox route/page.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: notificationTypeValues }).notNull(),
    payload: jsonb("payload").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notifications_user_id_idx").on(table.userId)],
);
