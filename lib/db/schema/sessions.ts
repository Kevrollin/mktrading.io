import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/users";

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
    // Sliding: refreshed on use, up to absoluteExpiresAt.
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // Fixed at creation, never extended.
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

// Separate from `sessions` on purpose: "remember device" skips only the MFA
// challenge, never the password, and must be wiped independently of a
// user's normal sessions on password/MFA change or "log out everywhere".
export const trustedDevices = pgTable(
  "trusted_devices",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Fixed grant, not sliding.
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [index("trusted_devices_user_id_idx").on(table.userId)],
);
