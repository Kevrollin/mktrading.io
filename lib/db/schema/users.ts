import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userStatusValues = ["active", "suspended", "restricted"] as const;
export type UserStatus = (typeof userStatusValues)[number];

export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // Always stored lowercased; normalize before every read/write.
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  status: text("status", { enum: userStatusValues }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
