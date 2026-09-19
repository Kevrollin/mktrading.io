import { createHash } from "node:crypto";
import { and, eq, gte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import type { DbTransaction } from "@/lib/db/client";
import { idempotencyKeys, ledgerAccounts, ledgerEntries } from "@/lib/db/schema";
import type { TransactionType } from "@/lib/db/schema";
import { getOrCreateAccount, type AccountRef } from "@/lib/ledger/accounts";

export class InsufficientFundsError extends Error {
  constructor() {
    super("Insufficient funds.");
  }
}

export class IdempotencyKeyReuseError extends Error {
  constructor() {
    super("Idempotency key reused with different inputs.");
  }
}

export interface PostLedgerEntryInput {
  /** Caller-supplied, unique per logical operation (not per retry). */
  idempotencyKey: string;
  scope: string;
  debitAccount: AccountRef;
  creditAccount: AccountRef;
  /** Decimal string — never a JS number. */
  amount: string;
  currency: string;
  transactionType: TransactionType;
  reference: string;
  actorUserId: string;
  metadata?: Record<string, unknown>;
}

export interface PostLedgerEntryResult {
  entryId: string;
  alreadyApplied: boolean;
}

function hashRequest(input: PostLedgerEntryInput): string {
  const normalized = JSON.stringify({
    debitAccount: input.debitAccount,
    creditAccount: input.creditAccount,
    amount: input.amount,
    currency: input.currency,
    transactionType: input.transactionType,
    reference: input.reference,
  });
  return createHash("sha256").update(normalized).digest("hex");
}

async function applyDebit(tx: DbTransaction, accountId: string, amount: string): Promise<void> {
  // The guard *is* the concurrency control: this single statement checks
  // and mutates atomically under the row's lock, so there's no window
  // where two concurrent debits both read a stale balance and both
  // succeed. TREASURY is exempt from the floor (it's allowed negative).
  const [updated] = await tx
    .update(ledgerAccounts)
    .set({ balance: sql`${ledgerAccounts.balance} - ${amount}`, updatedAt: new Date() })
    .where(
      and(
        eq(ledgerAccounts.id, accountId),
        or(eq(ledgerAccounts.accountType, "TREASURY"), gte(ledgerAccounts.balance, amount)),
      ),
    )
    .returning({ balance: ledgerAccounts.balance });

  if (!updated) {
    throw new InsufficientFundsError();
  }
}

async function applyCredit(tx: DbTransaction, accountId: string, amount: string): Promise<void> {
  await tx
    .update(ledgerAccounts)
    .set({ balance: sql`${ledgerAccounts.balance} + ${amount}`, updatedAt: new Date() })
    .where(eq(ledgerAccounts.id, accountId));
}

/**
 * The transaction-scoped core — takes an existing `tx` rather than
 * opening its own, so callers that need to compose a ledger posting with
 * other writes (e.g. `requestWithdrawal` creating the withdrawal row and
 * locking funds atomically together) can pass their own transaction and
 * get true all-or-nothing behavior. Standalone callers should use
 * `postLedgerEntry` below instead of calling this directly — nesting
 * `db.transaction()` calls would silently open a second, independent
 * connection/transaction rather than participating in the outer one.
 */
export async function postLedgerEntryInTx(
  tx: DbTransaction,
  input: PostLedgerEntryInput,
): Promise<PostLedgerEntryResult> {
  const requestHash = hashRequest(input);

  // 1. Claim the idempotency key before touching any balance. A
  // concurrent request with the same key blocks on this row's lock
  // until this transaction commits or rolls back, then re-evaluates —
  // genuinely simultaneous identical requests are serialized here, not
  // raced.
  const [claimed] = await tx
    .insert(idempotencyKeys)
    .values({ key: input.idempotencyKey, scope: input.scope, requestHash })
    .onConflictDoNothing()
    .returning();

  if (!claimed) {
    const [existing] = await tx
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, input.idempotencyKey));
    if (!existing) {
      throw new Error("Idempotency key vanished mid-transaction.");
    }
    if (existing.requestHash !== requestHash) {
      throw new IdempotencyKeyReuseError();
    }
    const snapshot = existing.resultSnapshot as { entryId: string } | null;
    if (!snapshot) {
      throw new Error("Idempotency key is still being processed by another request.");
    }
    return { entryId: snapshot.entryId, alreadyApplied: true };
  }

  // 2. Lazily get-or-create both accounts.
  const debitAccountId = await getOrCreateAccount(tx, input.debitAccount);
  const creditAccountId = await getOrCreateAccount(tx, input.creditAccount);

  // 3. Fixed lock order (sorted by id), regardless of which side is
  // debit/credit in this particular call — avoids deadlocking against a
  // concurrent operation touching the same two accounts in reversed roles.
  const debitFirst = debitAccountId < creditAccountId;

  if (debitFirst) {
    await applyDebit(tx, debitAccountId, input.amount);
    await applyCredit(tx, creditAccountId, input.amount);
  } else {
    await applyCredit(tx, creditAccountId, input.amount);
    await applyDebit(tx, debitAccountId, input.amount);
  }

  // 6. Insert the immutable entry.
  const [entry] = await tx
    .insert(ledgerEntries)
    .values({
      debitAccountId,
      creditAccountId,
      amount: input.amount,
      currency: input.currency,
      reference: input.reference,
      transactionType: input.transactionType,
      actorUserId: input.actorUserId,
      metadata: input.metadata ?? {},
      idempotencyKey: input.idempotencyKey,
    })
    .returning({ id: ledgerEntries.id });
  if (!entry) {
    throw new Error("Failed to insert ledger entry.");
  }

  // 7. Store the result snapshot for future retries of this key.
  await tx
    .update(idempotencyKeys)
    .set({ resultSnapshot: { entryId: entry.id } })
    .where(eq(idempotencyKeys.key, input.idempotencyKey));

  return { entryId: entry.id, alreadyApplied: false };
}

/**
 * Standalone entry point — opens its own transaction and delegates to
 * `postLedgerEntryInTx`. Use this for a financial operation that isn't
 * already part of a larger transaction (e.g. an admin adjustment).
 */
export async function postLedgerEntry(
  input: PostLedgerEntryInput,
): Promise<PostLedgerEntryResult> {
  return db.transaction((tx) => postLedgerEntryInTx(tx, input));
}
