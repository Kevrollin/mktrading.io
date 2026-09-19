import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { currencies, ledgerAccounts, withdrawals } from "@/lib/db/schema";

export interface CurrencyBalance {
  currency: string;
  available: string;
  locked: string;
  /** Always "0" — no real deposit rail exists yet; nothing ever posts a
   * DEPOSIT_PENDING entry in this milestone. */
  pendingDeposit: string;
  pendingWithdrawal: string;
  total: string;
}

const PENDING_WITHDRAWAL_STATUSES = [
  "PENDING_REVIEW",
  "PENDING_APPROVAL",
  "EXECUTION_AUTHORIZED",
  "PROCESSING",
] as const;

/**
 * All arithmetic here happens in Postgres (SUM over `numeric` columns),
 * never in JS — the values coming back are already-exact decimal
 * strings, merged by currency code without any numeric operations on
 * this side.
 */
export async function getWalletSummary(userId: string): Promise<CurrencyBalance[]> {
  const [activeCurrencies, ledgerRows, pendingRows] = await Promise.all([
    db.select({ code: currencies.code }).from(currencies).where(eq(currencies.isActive, true)),
    db
      .select({
        currency: ledgerAccounts.currency,
        available: sql<string>`coalesce(sum(case when ${ledgerAccounts.accountType} = 'AVAILABLE' then ${ledgerAccounts.balance} else 0 end), 0)`,
        locked: sql<string>`coalesce(sum(case when ${ledgerAccounts.accountType} = 'LOCKED' then ${ledgerAccounts.balance} else 0 end), 0)`,
        total: sql<string>`coalesce(sum(${ledgerAccounts.balance}), 0)`,
      })
      .from(ledgerAccounts)
      .where(and(eq(ledgerAccounts.ownerType, "USER"), eq(ledgerAccounts.ownerUserId, userId)))
      .groupBy(ledgerAccounts.currency),
    db
      .select({
        currency: withdrawals.currency,
        pending: sql<string>`coalesce(sum(${withdrawals.amount}), 0)`,
      })
      .from(withdrawals)
      .where(
        and(eq(withdrawals.userId, userId), inArray(withdrawals.status, PENDING_WITHDRAWAL_STATUSES)),
      )
      .groupBy(withdrawals.currency),
  ]);

  const ledgerByCurrency = new Map(ledgerRows.map((row) => [row.currency, row]));
  const pendingByCurrency = new Map(pendingRows.map((row) => [row.currency, row.pending]));

  return activeCurrencies.map(({ code }) => {
    const ledger = ledgerByCurrency.get(code);
    return {
      currency: code,
      available: ledger?.available ?? "0",
      locked: ledger?.locked ?? "0",
      pendingDeposit: "0",
      pendingWithdrawal: pendingByCurrency.get(code) ?? "0",
      total: ledger?.total ?? "0",
    };
  });
}
