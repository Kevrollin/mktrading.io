import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { currencies } from "@/lib/db/schema/currencies";
import { ledgerEntries } from "@/lib/db/schema/ledger";
import { users } from "@/lib/db/schema/users";

export const depositMethodValues = ["CRYPTO", "MOBILE_MONEY"] as const;
export type DepositMethod = (typeof depositMethodValues)[number];

export const depositStatusValues = ["PENDING", "CONFIRMED", "FAILED", "CANCELLED"] as const;
export type DepositStatus = (typeof depositStatusValues)[number];

export const deposits = pgTable(
  "deposits",
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
    method: text("method", { enum: depositMethodValues }).notNull(),
    status: text("status", { enum: depositStatusValues }).notNull().default("PENDING"),
    // Crypto: the user's stated intent, not authoritative. Mobile money:
    // authoritative — the STK push charges exactly this.
    requestedAmount: numeric("requested_amount", { precision: 38, scale: 18 }).notNull(),
    // Set at confirmation. Crypto may differ from requestedAmount (fees,
    // sender error) — the admin enters what they actually observed.
    confirmedAmount: numeric("confirmed_amount", { precision: 38, scale: 18 }),
    referenceCode: text("reference_code").notNull().unique(),
    // Crypto only — snapshotted from platform_wallets at request time so
    // a later address change doesn't retroactively change an in-flight
    // request. Every user sends to the same shared address per currency
    // (no per-user derived addresses) — the reference code plus admin
    // cross-referencing amount/timing is the only attribution mechanism.
    destinationAddress: text("destination_address"),
    phone: text("phone"), // mobile money only
    providerReference: text("provider_reference"), // the mpesa provider's own reference
    txHash: text("tx_hash"), // crypto only, admin-entered at confirmation
    readyToConfirmAt: timestamp("ready_to_confirm_at", { withTimezone: true }), // mobile money only
    rejectionReason: text("rejection_reason"),
    // Request-level dedup — unlike withdrawals, a deposit *request* never
    // calls postLedgerEntryInTx (nothing to lock yet), so it isn't
    // naturally covered by the ledger's own idempotency_keys table.
    idempotencyKey: text("idempotency_key"),
    settlementLedgerEntryId: uuid("settlement_ledger_entry_id").references(() => ledgerEntries.id),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("deposits_user_id_idx").on(table.userId),
    // The index the lazy-settlement due-query (status='PENDING' and
    // method='MOBILE_MONEY' and ready_to_confirm_at <= now) needs.
    index("deposits_status_method_ready_idx").on(table.status, table.method, table.readyToConfirmAt),
  ],
);
