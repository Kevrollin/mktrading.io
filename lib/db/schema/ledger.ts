import { index, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/users";
import { currencies } from "@/lib/db/schema/currencies";

export const accountOwnerTypeValues = ["USER", "SYSTEM"] as const;
export type AccountOwnerType = (typeof accountOwnerTypeValues)[number];

export const accountTypeValues = ["AVAILABLE", "LOCKED", "TREASURY"] as const;
export type AccountType = (typeof accountTypeValues)[number];

// One row per (owner, currency, bucket) — AVAILABLE/LOCKED are user
// accounts, TREASURY is the one SYSTEM-owned counterparty per currency,
// explicitly allowed to go negative (it tracks the platform's net
// unbacked-liability from admin-issued demo credits, not a real cash
// position). Lazily created on first use via get-or-create — never
// pre-provisioned per user at signup. True uniqueness is a partial,
// WHERE-qualified unique index that Drizzle's table builder can't
// express — it's hand-written in the SQL migration, not here.
export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ownerType: text("owner_type", { enum: accountOwnerTypeValues }).notNull(),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "restrict" }),
    currency: text("currency")
      .notNull()
      .references(() => currencies.code),
    accountType: text("account_type", { enum: accountTypeValues }).notNull(),
    // Materialized running balance — see lib/ledger/post.ts for exactly
    // how this stays consistent with ledger_entries under concurrency.
    balance: numeric("balance", { precision: 38, scale: 18 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ledger_accounts_owner_user_id_idx").on(table.ownerUserId),
    index("ledger_accounts_currency_idx").on(table.currency),
  ],
);

export const transactionTypeValues = [
  "DEPOSIT_PENDING",
  "DEPOSIT_CONFIRMED",
  "TRADE_STAKE_LOCK",
  "TRADE_LOSS",
  "TRADE_WIN",
  "TRADE_REFUND",
  "WITHDRAWAL_PENDING",
  "WITHDRAWAL_APPROVED",
  "WITHDRAWAL_REJECTED",
  "FEE",
  "ADMIN_ADJUSTMENT",
] as const;
export type TransactionType = (typeof transactionTypeValues)[number];

// Immutable: no update/delete path anywhere in application code, and the
// migration adds a BEFORE UPDATE OR DELETE trigger that raises — a hard
// DB guarantee, not just convention, since the app connects with the
// same full-access credential it always has.
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    debitAccountId: uuid("debit_account_id")
      .notNull()
      .references(() => ledgerAccounts.id),
    creditAccountId: uuid("credit_account_id")
      .notNull()
      .references(() => ledgerAccounts.id),
    amount: numeric("amount", { precision: 38, scale: 18 }).notNull(),
    currency: text("currency")
      .notNull()
      .references(() => currencies.code),
    reference: text("reference").notNull(),
    transactionType: text("transaction_type", { enum: transactionTypeValues }).notNull(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id),
    metadata: jsonb("metadata").notNull().default({}),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ledger_entries_debit_account_id_idx").on(table.debitAccountId),
    index("ledger_entries_credit_account_id_idx").on(table.creditAccountId),
    index("ledger_entries_idempotency_key_idx").on(table.idempotencyKey),
    index("ledger_entries_transaction_type_idx").on(table.transactionType),
  ],
);

// Claimed first, inside the same transaction as the ledger posting it
// guards — see lib/ledger/post.ts.
export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text("key").primaryKey(),
  scope: text("scope").notNull(), // e.g. "ledger.admin_adjustment", "ledger.withdrawal_lock"
  requestHash: text("request_hash").notNull(),
  resultSnapshot: jsonb("result_snapshot"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
