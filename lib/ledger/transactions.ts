import { and, desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/client";
import { ledgerAccounts, ledgerEntries } from "@/lib/db/schema";
import type { AccountType, TransactionType } from "@/lib/db/schema";

export interface UserTransactionRow {
  id: string;
  amount: string;
  currency: string;
  transactionType: TransactionType;
  reference: string;
  createdAt: Date;
  /** From this user's perspective — "internal" when both sides of the
   * entry are the same user's own accounts (e.g. a withdrawal lock moving
   * AVAILABLE -> LOCKED). */
  direction: "credit" | "debit" | "internal";
  accountType: AccountType;
}

const debitAccounts = alias(ledgerAccounts, "debit_accounts");
const creditAccounts = alias(ledgerAccounts, "credit_accounts");

export async function listUserTransactions(
  userId: string,
  options?: { currency?: string; limit?: number },
): Promise<UserTransactionRow[]> {
  const limit = options?.limit ?? 50;

  const ownsEither = or(eq(debitAccounts.ownerUserId, userId), eq(creditAccounts.ownerUserId, userId));
  const where = options?.currency
    ? and(ownsEither, eq(ledgerEntries.currency, options.currency))
    : ownsEither;

  const rows = await db
    .select({
      id: ledgerEntries.id,
      amount: ledgerEntries.amount,
      currency: ledgerEntries.currency,
      transactionType: ledgerEntries.transactionType,
      reference: ledgerEntries.reference,
      createdAt: ledgerEntries.createdAt,
      debitOwnerUserId: debitAccounts.ownerUserId,
      debitAccountType: debitAccounts.accountType,
      creditOwnerUserId: creditAccounts.ownerUserId,
      creditAccountType: creditAccounts.accountType,
    })
    .from(ledgerEntries)
    .innerJoin(debitAccounts, eq(ledgerEntries.debitAccountId, debitAccounts.id))
    .innerJoin(creditAccounts, eq(ledgerEntries.creditAccountId, creditAccounts.id))
    .where(where)
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(limit);

  return rows.map((row) => {
    const debitIsUser = row.debitOwnerUserId === userId;
    const creditIsUser = row.creditOwnerUserId === userId;
    const direction = debitIsUser && creditIsUser ? "internal" : creditIsUser ? "credit" : "debit";
    const accountType = creditIsUser ? row.creditAccountType : row.debitAccountType;

    return {
      id: row.id,
      amount: row.amount,
      currency: row.currency,
      transactionType: row.transactionType,
      reference: row.reference,
      createdAt: row.createdAt,
      direction,
      accountType,
    };
  });
}
