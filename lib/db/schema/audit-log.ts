import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/users";

// General-purpose audit trail, reused by later milestones. This milestone
// writes to it for security-relevant self-service actions: password
// change, MFA change, session revocation.
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Nullable: some actions are system-initiated, not actor-initiated.
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    correlationId: text("correlation_id").notNull(),
  },
  (table) => [index("audit_logs_actor_user_id_idx").on(table.actorUserId)],
);
