import { pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/users";

// Matches the platform's eventual admin roles; only USER is actually
// assigned/used this milestone — no admin authorization logic exists yet.
export const roleNameValues = [
  "USER",
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "COMPLIANCE_ADMIN",
  "OPERATIONS_ADMIN",
  "RISK_ADMIN",
] as const;
export type RoleName = (typeof roleNameValues)[number];

export const roles = pgTable("roles", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name", { enum: roleNameValues }).notNull().unique(),
  description: text("description").notNull(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    grantedBy: uuid("granted_by").references(() => users.id),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);
