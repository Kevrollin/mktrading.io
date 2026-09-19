import { index, jsonb, numeric, pgTable, smallint, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/users";
import { currencies } from "@/lib/db/schema/currencies";
import { ledgerEntries } from "@/lib/db/schema/ledger";

export const withdrawalStatusValues = [
  "DRAFT",
  "PENDING_REVIEW",
  "PENDING_APPROVAL",
  "APPROVED",
  "EXECUTION_AUTHORIZED",
  "PROCESSING",
  "COMPLETED",
  "REJECTED",
  "FAILED",
  "CANCELLED",
] as const;
export type WithdrawalStatus = (typeof withdrawalStatusValues)[number];

export const withdrawals = pgTable(
  "withdrawals",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    currency: text("currency")
      .notNull()
      .references(() => currencies.code),
    amount: numeric("amount", { precision: 38, scale: 18 }).notNull(),
    // Freeform method/details — no real payout rail exists yet.
    destination: jsonb("destination").notNull(),
    status: text("status", { enum: withdrawalStatusValues }).notNull().default("PENDING_REVIEW"),
    // sha256({withdrawalId, userId, currency, amount, destination}) —
    // deliberately excludes status/timestamps. See lib/withdrawals/request-hash.ts.
    requestHash: text("request_hash").notNull(),
    approvalsRequiredCount: smallint("approvals_required_count").notNull().default(5),
    lockLedgerEntryId: uuid("lock_ledger_entry_id").references(() => ledgerEntries.id),
    settlementLedgerEntryId: uuid("settlement_ledger_entry_id").references(() => ledgerEntries.id),
    rejectionReason: text("rejection_reason"),
    providerReference: text("provider_reference"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("withdrawals_user_id_idx").on(table.userId),
    index("withdrawals_status_idx").on(table.status),
  ],
);

// One row per admin's affirmative APPROVE decision only. Rejection is a
// single-admin status transition + an audit_logs row, not a row here —
// see the plan for why the quorum is asymmetric (5 to approve, 1 to reject).
export const withdrawalApprovals = pgTable(
  "withdrawal_approvals",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    withdrawalId: uuid("withdrawal_id")
      .notNull()
      .references(() => withdrawals.id, { onDelete: "cascade" }),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => users.id),
    requestHash: text("request_hash").notNull(), // snapshot at approval time
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("withdrawal_approvals_withdrawal_id_idx").on(table.withdrawalId),
    // The DB-level guarantee behind "an admin cannot approve twice."
    unique("withdrawal_approvals_withdrawal_id_admin_user_id_unique").on(
      table.withdrawalId,
      table.adminUserId,
    ),
  ],
);
