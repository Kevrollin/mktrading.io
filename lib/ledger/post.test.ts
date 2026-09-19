import { eq, or, sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { createTestUser } from "@/lib/db/test-utils";
import { ledgerEntries } from "@/lib/db/schema";
import { getOrCreateAccount, treasuryAccount, userAccount, type AccountRef } from "@/lib/ledger/accounts";
import { IdempotencyKeyReuseError, InsufficientFundsError, postLedgerEntry } from "@/lib/ledger/post";

const CURRENCY = "KES";

afterEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE ledger_entries, idempotency_keys, ledger_accounts, users CASCADE`,
  );
});

async function accountId(ref: AccountRef): Promise<string> {
  return db.transaction((tx) => getOrCreateAccount(tx, ref));
}

async function balanceOf(id: string): Promise<string> {
  const [row] = await db.execute(sql`select balance from ledger_accounts where id = ${id}`);
  return String(row?.balance ?? "0");
}

/** Recomputed straight from ledger_entries, independent of the
 * materialized `balance` column — this is the reconciliation invariant. */
async function reconciledBalance(id: string): Promise<string> {
  const [row] = await db
    .select({
      balance: sql<string>`coalesce(sum(case when ${ledgerEntries.creditAccountId} = ${id} then ${ledgerEntries.amount} else 0 end), 0) - coalesce(sum(case when ${ledgerEntries.debitAccountId} = ${id} then ${ledgerEntries.amount} else 0 end), 0)`,
    })
    .from(ledgerEntries)
    .where(or(eq(ledgerEntries.creditAccountId, id), eq(ledgerEntries.debitAccountId, id)));
  return row?.balance ?? "0";
}

describe("postLedgerEntry", () => {
  it("credits and debits the correct accounts", async () => {
    const user = await createTestUser();
    const treasury = treasuryAccount(CURRENCY);
    const available = userAccount(user.id, CURRENCY, "AVAILABLE");

    await postLedgerEntry({
      idempotencyKey: crypto.randomUUID(),
      scope: "test",
      debitAccount: treasury,
      creditAccount: available,
      amount: "100.5",
      currency: CURRENCY,
      transactionType: "ADMIN_ADJUSTMENT",
      reference: "test:credit",
      actorUserId: user.id,
    });

    const availableId = await accountId(available);
    const treasuryId = await accountId(treasury);
    expect(await balanceOf(availableId)).toBe("100.500000000000000000");
    expect(await balanceOf(treasuryId)).toBe("-100.500000000000000000");
  });

  it("rejects a debit that would push balance below zero, with no partial state", async () => {
    const user = await createTestUser();
    const available = userAccount(user.id, CURRENCY, "AVAILABLE");
    const locked = userAccount(user.id, CURRENCY, "LOCKED");
    const key = crypto.randomUUID();

    await expect(
      postLedgerEntry({
        idempotencyKey: key,
        scope: "test",
        debitAccount: available,
        creditAccount: locked,
        amount: "10",
        currency: CURRENCY,
        transactionType: "WITHDRAWAL_PENDING",
        reference: "test:insufficient",
        actorUserId: user.id,
      }),
    ).rejects.toThrow(InsufficientFundsError);

    const availableId = await accountId(available);
    const lockedId = await accountId(locked);
    expect(await balanceOf(availableId)).toBe("0.000000000000000000");
    expect(await balanceOf(lockedId)).toBe("0.000000000000000000");

    const [entry] = await db.select().from(ledgerEntries).where(eq(ledgerEntries.reference, "test:insufficient"));
    expect(entry).toBeUndefined();

    // The idempotency-key claim rolled back with everything else — a
    // retry with the same key hits the same insufficient-funds error
    // again, not a stale "key reuse" error.
    await expect(
      postLedgerEntry({
        idempotencyKey: key,
        scope: "test",
        debitAccount: available,
        creditAccount: locked,
        amount: "10",
        currency: CURRENCY,
        transactionType: "WITHDRAWAL_PENDING",
        reference: "test:insufficient",
        actorUserId: user.id,
      }),
    ).rejects.toThrow(InsufficientFundsError);
  });

  it("treats a retried idempotency key as a no-op, not a double application", async () => {
    const user = await createTestUser();
    const treasury = treasuryAccount(CURRENCY);
    const available = userAccount(user.id, CURRENCY, "AVAILABLE");
    const key = crypto.randomUUID();
    const input = {
      idempotencyKey: key,
      scope: "test",
      debitAccount: treasury,
      creditAccount: available,
      amount: "50",
      currency: CURRENCY,
      transactionType: "ADMIN_ADJUSTMENT" as const,
      reference: "test:retry",
      actorUserId: user.id,
    };

    const first = await postLedgerEntry(input);
    const second = await postLedgerEntry(input);

    expect(first.alreadyApplied).toBe(false);
    expect(second.alreadyApplied).toBe(true);
    expect(second.entryId).toBe(first.entryId);

    const availableId = await accountId(available);
    expect(await balanceOf(availableId)).toBe("50.000000000000000000");
  });

  it("throws when the same key is reused with different inputs", async () => {
    const user = await createTestUser();
    const treasury = treasuryAccount(CURRENCY);
    const available = userAccount(user.id, CURRENCY, "AVAILABLE");
    const key = crypto.randomUUID();

    await postLedgerEntry({
      idempotencyKey: key,
      scope: "test",
      debitAccount: treasury,
      creditAccount: available,
      amount: "50",
      currency: CURRENCY,
      transactionType: "ADMIN_ADJUSTMENT",
      reference: "test:reuse",
      actorUserId: user.id,
    });

    await expect(
      postLedgerEntry({
        idempotencyKey: key,
        scope: "test",
        debitAccount: treasury,
        creditAccount: available,
        amount: "999",
        currency: CURRENCY,
        transactionType: "ADMIN_ADJUSTMENT",
        reference: "test:reuse",
        actorUserId: user.id,
      }),
    ).rejects.toThrow(IdempotencyKeyReuseError);
  });

  it("under concurrent debits, allows exactly the affordable count and stays reconciled", async () => {
    const user = await createTestUser();
    const treasury = treasuryAccount(CURRENCY);
    const available = userAccount(user.id, CURRENCY, "AVAILABLE");
    const locked = userAccount(user.id, CURRENCY, "LOCKED");

    await postLedgerEntry({
      idempotencyKey: crypto.randomUUID(),
      scope: "test",
      debitAccount: treasury,
      creditAccount: available,
      amount: "100",
      currency: CURRENCY,
      transactionType: "ADMIN_ADJUSTMENT",
      reference: "test:fund",
      actorUserId: user.id,
    });

    const attempts = 20;
    const debitAmount = "10";
    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () =>
        postLedgerEntry({
          idempotencyKey: crypto.randomUUID(),
          scope: "test",
          debitAccount: available,
          creditAccount: locked,
          amount: debitAmount,
          currency: CURRENCY,
          transactionType: "WITHDRAWAL_PENDING",
          reference: "test:race-debit",
          actorUserId: user.id,
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    expect(succeeded).toBe(10); // exactly 100 / 10 affordable, never more

    const availableId = await accountId(available);
    const lockedId = await accountId(locked);
    expect(await balanceOf(availableId)).toBe("0.000000000000000000");
    expect(await balanceOf(lockedId)).toBe("100.000000000000000000");
    expect(await reconciledBalance(availableId)).toBe(await balanceOf(availableId));
    expect(await reconciledBalance(lockedId)).toBe(await balanceOf(lockedId));
  });

  it("under concurrent credits, every credit lands and stays reconciled", async () => {
    const user = await createTestUser();
    const treasury = treasuryAccount(CURRENCY);
    const available = userAccount(user.id, CURRENCY, "AVAILABLE");

    const attempts = 20;
    const creditAmount = "5";
    await Promise.all(
      Array.from({ length: attempts }, () =>
        postLedgerEntry({
          idempotencyKey: crypto.randomUUID(),
          scope: "test",
          debitAccount: treasury,
          creditAccount: available,
          amount: creditAmount,
          currency: CURRENCY,
          transactionType: "ADMIN_ADJUSTMENT",
          reference: "test:race-credit",
          actorUserId: user.id,
        }),
      ),
    );

    const availableId = await accountId(available);
    expect(await balanceOf(availableId)).toBe("100.000000000000000000");
    expect(await reconciledBalance(availableId)).toBe(await balanceOf(availableId));
  });
});
