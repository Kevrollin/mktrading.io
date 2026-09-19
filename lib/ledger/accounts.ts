import { and, eq, isNull } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db/client";
import { ledgerAccounts } from "@/lib/db/schema";
import type { AccountOwnerType, AccountType } from "@/lib/db/schema";

export interface AccountRef {
  ownerType: AccountOwnerType;
  ownerUserId?: string | null;
  currency: string;
  accountType: AccountType;
}

export function userAccount(
  userId: string,
  currency: string,
  accountType: "AVAILABLE" | "LOCKED",
): AccountRef {
  return { ownerType: "USER", ownerUserId: userId, currency, accountType };
}

export function treasuryAccount(currency: string): AccountRef {
  return { ownerType: "SYSTEM", ownerUserId: null, currency, accountType: "TREASURY" };
}

/** Lazily creates ledger accounts on first use rather than pre-provisioning
 * every user x currency pair at signup. Must run inside the same
 * transaction as whatever posts against the returned account id — takes
 * `tx`, never the top-level `db`, so it always participates in the
 * caller's transaction rather than opening its own. */
export async function getOrCreateAccount(tx: DbTransaction, ref: AccountRef): Promise<string> {
  const ownerCondition = ref.ownerUserId
    ? eq(ledgerAccounts.ownerUserId, ref.ownerUserId)
    : isNull(ledgerAccounts.ownerUserId);
  const where = and(
    eq(ledgerAccounts.ownerType, ref.ownerType),
    ownerCondition,
    eq(ledgerAccounts.currency, ref.currency),
    eq(ledgerAccounts.accountType, ref.accountType),
  );

  const [existing] = await tx.select({ id: ledgerAccounts.id }).from(ledgerAccounts).where(where);
  if (existing) return existing.id;

  const [created] = await tx
    .insert(ledgerAccounts)
    .values({
      ownerType: ref.ownerType,
      ownerUserId: ref.ownerUserId ?? null,
      currency: ref.currency,
      accountType: ref.accountType,
    })
    .onConflictDoNothing()
    .returning({ id: ledgerAccounts.id });
  if (created) return created.id;

  // Lost the create race to a concurrent request (the partial unique
  // index rejected our insert) — the row now exists, look it up again.
  const [afterRace] = await tx.select({ id: ledgerAccounts.id }).from(ledgerAccounts).where(where);
  if (!afterRace) throw new Error("Failed to get or create ledger account.");
  return afterRace.id;
}
