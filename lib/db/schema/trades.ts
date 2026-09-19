import { index, numeric, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { currencies } from "@/lib/db/schema/currencies";
import { instruments } from "@/lib/db/schema/instruments";
import { ledgerEntries } from "@/lib/db/schema/ledger";
import { users } from "@/lib/db/schema/users";

export const tradeDirectionValues = ["RISE", "FALL"] as const;
export type TradeDirection = (typeof tradeDirectionValues)[number];

export const tradeStatusValues = ["OPEN", "WON", "LOST", "REFUNDED"] as const;
export type TradeStatus = (typeof tradeStatusValues)[number];

export const trades = pgTable(
  "trades",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    instrumentId: text("instrument_id")
      .notNull()
      .references(() => instruments.id),
    currency: text("currency")
      .notNull()
      .references(() => currencies.code),
    direction: text("direction", { enum: tradeDirectionValues }).notNull(),
    durationSeconds: smallint("duration_seconds").notNull(),
    stakeAmount: numeric("stake_amount", { precision: 38, scale: 18 }).notNull(),
    // Snapshotted from the instrument at placement time — never re-read
    // live at settlement, same principle as withdrawals.requestHash.
    payoutPercent: numeric("payout_percent", { precision: 5, scale: 2 }).notNull(),
    entryPrice: numeric("entry_price", { precision: 20, scale: 8 }).notNull(),
    settlementPrice: numeric("settlement_price", { precision: 20, scale: 8 }),
    status: text("status", { enum: tradeStatusValues }).notNull().default("OPEN"),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    stakeLockLedgerEntryId: uuid("stake_lock_ledger_entry_id").references(() => ledgerEntries.id),
    // The stake-side settlement leg (WIN/LOSS/REFUND all have exactly one).
    settlementLedgerEntryId: uuid("settlement_ledger_entry_id").references(() => ledgerEntries.id),
    // WIN only — the separate TREASURY -> AVAILABLE profit leg.
    profitLedgerEntryId: uuid("profit_ledger_entry_id").references(() => ledgerEntries.id),
    refundReason: text("refund_reason"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("trades_user_id_idx").on(table.userId),
    index("trades_status_expires_at_idx").on(table.status, table.expiresAt),
    index("trades_instrument_id_idx").on(table.instrumentId),
  ],
);
