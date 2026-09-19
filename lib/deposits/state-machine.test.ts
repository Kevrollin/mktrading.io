import { eq, or, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { createTestUser } from "@/lib/db/test-utils";
import { deposits, ledgerEntries } from "@/lib/db/schema";
import { getOrCreateAccount, treasuryAccount, userAccount, type AccountRef } from "@/lib/ledger/accounts";
import { setPlatformWalletAddress } from "@/lib/platform-wallets/service";
import {
  cancelDeposit,
  confirmCryptoDeposit,
  DepositError,
  rejectDeposit,
  requestCryptoDeposit,
  requestMobileMoneyDeposit,
  settleDueMobileMoneyDepositsForUser,
} from "@/lib/deposits/state-machine";

const CRYPTO_CURRENCY = "BTC";
const VALID_BTC_ADDRESS = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"; // genesis block coinbase address

// platform_wallets has a nullable FK to users, same as instruments did —
// another *.test.ts file's TRUNCATE ... users CASCADE can silently wipe
// it depending on file run order (see the instruments beforeEach lesson
// from the trading engine milestone). Re-configuring it here on every
// test makes this file self-sufficient regardless of ordering.
beforeEach(async () => {
  const admin = await createTestUser();
  await setPlatformWalletAddress({ currency: CRYPTO_CURRENCY, address: VALID_BTC_ADDRESS, adminUserId: admin.id });
});

afterEach(async () => {
  // Deliberately NOT truncating users here, same reasoning as
  // lib/trading/state-machine.test.ts — TRUNCATE ... users CASCADE would
  // cascade into platform_wallets too via its nullable
  // updated_by_user_id FK. createTestUser() always uses a unique email,
  // so leaving users un-truncated across tests in this file causes no
  // correctness issue, just a few extra rows.
  await db.execute(
    sql`TRUNCATE TABLE deposits, ledger_entries, idempotency_keys, ledger_accounts, audit_logs CASCADE`,
  );
});

async function accountId(ref: AccountRef): Promise<string> {
  return db.transaction((tx) => getOrCreateAccount(tx, ref));
}

async function balanceOf(id: string): Promise<string> {
  const [row] = await db.execute(sql`select balance from ledger_accounts where id = ${id}`);
  return String(row?.balance ?? "0");
}

async function reconciledBalance(id: string): Promise<string> {
  const [row] = await db
    .select({
      balance: sql<string>`coalesce(sum(case when ${ledgerEntries.creditAccountId} = ${id} then ${ledgerEntries.amount} else 0 end), 0) - coalesce(sum(case when ${ledgerEntries.debitAccountId} = ${id} then ${ledgerEntries.amount} else 0 end), 0)`,
    })
    .from(ledgerEntries)
    .where(or(eq(ledgerEntries.creditAccountId, id), eq(ledgerEntries.debitAccountId, id)));
  return row?.balance ?? "0";
}

describe("requestCryptoDeposit", () => {
  it("snapshots the configured platform address and a fresh reference code", async () => {
    const user = await createTestUser();
    const deposit = await requestCryptoDeposit({
      userId: user.id,
      currency: CRYPTO_CURRENCY,
      requestedAmount: "0.01",
      idempotencyKey: crypto.randomUUID(),
    });

    expect(deposit.status).toBe("PENDING");
    expect(deposit.destinationAddress).toBe(VALID_BTC_ADDRESS);
    expect(deposit.referenceCode).toMatch(/^DEP-/);
  });

  it("is unaffected by a later address change for the same currency", async () => {
    const user = await createTestUser();
    const deposit = await requestCryptoDeposit({
      userId: user.id,
      currency: CRYPTO_CURRENCY,
      requestedAmount: "0.01",
      idempotencyKey: crypto.randomUUID(),
    });

    const admin = await createTestUser();
    await setPlatformWalletAddress({
      currency: CRYPTO_CURRENCY,
      address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
      adminUserId: admin.id,
    });

    const [reloaded] = await db.select().from(deposits).where(eq(deposits.id, deposit.id));
    expect(reloaded?.destinationAddress).toBe(VALID_BTC_ADDRESS);
  });

  it("rejects a currency with no configured platform address", async () => {
    const user = await createTestUser();
    await expect(
      requestCryptoDeposit({
        userId: user.id,
        currency: "USDT", // never configured in this test file
        requestedAmount: "10",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(DepositError);
  });
});

describe("requestMobileMoneyDeposit", () => {
  it("always creates a KES deposit with a provider reference and a future readyToConfirmAt", async () => {
    const user = await createTestUser();
    const deposit = await requestMobileMoneyDeposit({
      userId: user.id,
      requestedAmount: "500",
      phone: "+254712345678",
      idempotencyKey: crypto.randomUUID(),
    });

    expect(deposit.currency).toBe("KES");
    expect(deposit.status).toBe("PENDING");
    expect(deposit.providerReference).toMatch(/^DEV-/);
    expect(deposit.readyToConfirmAt).not.toBeNull();
    expect(deposit.readyToConfirmAt!.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("confirmCryptoDeposit", () => {
  it("credits AVAILABLE by confirmedAmount, which may differ from requestedAmount", async () => {
    const user = await createTestUser();
    const admin = await createTestUser();
    const deposit = await requestCryptoDeposit({
      userId: user.id,
      currency: CRYPTO_CURRENCY,
      requestedAmount: "0.01",
      idempotencyKey: crypto.randomUUID(),
    });

    const confirmed = await confirmCryptoDeposit({
      depositId: deposit.id,
      adminUserId: admin.id,
      txHash: "abc123def456",
      confirmedAmount: "0.0099", // slightly less than requested — network fee, say
      ip: null,
    });

    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.confirmedAmount).toBe("0.009900000000000000");

    const availableId = await accountId(userAccount(user.id, CRYPTO_CURRENCY, "AVAILABLE"));
    expect(await balanceOf(availableId)).toBe("0.009900000000000000");
    expect(await reconciledBalance(availableId)).toBe(await balanceOf(availableId));

    const treasuryId = await accountId(treasuryAccount(CRYPTO_CURRENCY));
    expect(await balanceOf(treasuryId)).toBe("-0.009900000000000000");
  });

  it("blocks an admin from confirming their own deposit", async () => {
    const user = await createTestUser();
    const deposit = await requestCryptoDeposit({
      userId: user.id,
      currency: CRYPTO_CURRENCY,
      requestedAmount: "0.01",
      idempotencyKey: crypto.randomUUID(),
    });

    await expect(
      confirmCryptoDeposit({
        depositId: deposit.id,
        adminUserId: user.id,
        txHash: "abc123",
        confirmedAmount: "0.01",
        ip: null,
      }),
    ).rejects.toThrow(DepositError);
  });

  it("rejects reusing a tx hash already used to confirm another deposit for the same currency", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const admin = await createTestUser();

    const depositA = await requestCryptoDeposit({
      userId: userA.id,
      currency: CRYPTO_CURRENCY,
      requestedAmount: "0.01",
      idempotencyKey: crypto.randomUUID(),
    });
    const depositB = await requestCryptoDeposit({
      userId: userB.id,
      currency: CRYPTO_CURRENCY,
      requestedAmount: "0.02",
      idempotencyKey: crypto.randomUUID(),
    });

    await confirmCryptoDeposit({
      depositId: depositA.id,
      adminUserId: admin.id,
      txHash: "shared-hash-123",
      confirmedAmount: "0.01",
      ip: null,
    });

    await expect(
      confirmCryptoDeposit({
        depositId: depositB.id,
        adminUserId: admin.id,
        txHash: "shared-hash-123",
        confirmedAmount: "0.02",
        ip: null,
      }),
    ).rejects.toThrow();
  });

  it("under concurrent confirmation attempts, settles exactly once", async () => {
    const user = await createTestUser();
    const admin = await createTestUser();
    const deposit = await requestCryptoDeposit({
      userId: user.id,
      currency: CRYPTO_CURRENCY,
      requestedAmount: "0.01",
      idempotencyKey: crypto.randomUUID(),
    });

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        confirmCryptoDeposit({
          depositId: deposit.id,
          adminUserId: admin.id,
          txHash: "race-hash",
          confirmedAmount: "0.01",
          ip: null,
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled");
    expect(succeeded).toHaveLength(1);

    const settlementEntries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.idempotencyKey, `deposit-confirm:${deposit.id}`));
    expect(settlementEntries).toHaveLength(1);

    const availableId = await accountId(userAccount(user.id, CRYPTO_CURRENCY, "AVAILABLE"));
    expect(await balanceOf(availableId)).toBe("0.010000000000000000");
    expect(await reconciledBalance(availableId)).toBe(await balanceOf(availableId));
  });
});

describe("mobile money lazy settlement", () => {
  it("settles a due deposit and leaves a not-yet-due one alone", async () => {
    const user = await createTestUser();
    const due = await requestMobileMoneyDeposit({
      userId: user.id,
      requestedAmount: "300",
      phone: "+254712345678",
      idempotencyKey: crypto.randomUUID(),
    });
    const notDue = await requestMobileMoneyDeposit({
      userId: user.id,
      requestedAmount: "50",
      phone: "+254712345678",
      idempotencyKey: crypto.randomUUID(),
    });

    await db.update(deposits).set({ readyToConfirmAt: new Date(Date.now() - 1000) }).where(eq(deposits.id, due.id));

    const settled = await settleDueMobileMoneyDepositsForUser(user.id);
    expect(settled.map((d) => d.id)).toContain(due.id);
    expect(settled.map((d) => d.id)).not.toContain(notDue.id);

    const [dueRow] = await db.select().from(deposits).where(eq(deposits.id, due.id));
    expect(dueRow?.status).toBe("CONFIRMED");
    expect(dueRow?.confirmedAmount).toBe("300.000000000000000000");

    const [notDueRow] = await db.select().from(deposits).where(eq(deposits.id, notDue.id));
    expect(notDueRow?.status).toBe("PENDING");
  });

  it("is a safe no-op when called again after settlement", async () => {
    const user = await createTestUser();
    const deposit = await requestMobileMoneyDeposit({
      userId: user.id,
      requestedAmount: "300",
      phone: "+254712345678",
      idempotencyKey: crypto.randomUUID(),
    });
    await db.update(deposits).set({ readyToConfirmAt: new Date(Date.now() - 1000) }).where(eq(deposits.id, deposit.id));

    await settleDueMobileMoneyDepositsForUser(user.id);
    await settleDueMobileMoneyDepositsForUser(user.id);

    const availableId = await accountId(userAccount(user.id, "KES", "AVAILABLE"));
    expect(await balanceOf(availableId)).toBe("300.000000000000000000");
  });

  it("posts the ledger entry with the depositing user as actor, not an admin", async () => {
    const user = await createTestUser();
    const deposit = await requestMobileMoneyDeposit({
      userId: user.id,
      requestedAmount: "300",
      phone: "+254712345678",
      idempotencyKey: crypto.randomUUID(),
    });
    await db.update(deposits).set({ readyToConfirmAt: new Date(Date.now() - 1000) }).where(eq(deposits.id, deposit.id));
    await settleDueMobileMoneyDepositsForUser(user.id);

    const [entry] = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.idempotencyKey, `deposit-confirm:${deposit.id}`));
    expect(entry?.actorUserId).toBe(user.id);
  });
});

describe("rejectDeposit / cancelDeposit", () => {
  it("rejectDeposit never posts a ledger entry", async () => {
    const user = await createTestUser();
    const admin = await createTestUser();
    const deposit = await requestCryptoDeposit({
      userId: user.id,
      currency: CRYPTO_CURRENCY,
      requestedAmount: "0.01",
      idempotencyKey: crypto.randomUUID(),
    });

    const rejected = await rejectDeposit({
      depositId: deposit.id,
      adminUserId: admin.id,
      reason: "looks fraudulent",
      ip: null,
    });
    expect(rejected.status).toBe("FAILED");

    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(sql`${ledgerEntries.metadata}->>'depositId' = ${deposit.id}`);
    expect(entries).toHaveLength(0);
  });

  it("blocks an admin from rejecting their own deposit", async () => {
    const user = await createTestUser();
    const deposit = await requestCryptoDeposit({
      userId: user.id,
      currency: CRYPTO_CURRENCY,
      requestedAmount: "0.01",
      idempotencyKey: crypto.randomUUID(),
    });

    await expect(
      rejectDeposit({ depositId: deposit.id, adminUserId: user.id, reason: "self", ip: null }),
    ).rejects.toThrow(DepositError);
  });

  it("cancelDeposit never posts a ledger entry and is ownership-guarded", async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    const deposit = await requestCryptoDeposit({
      userId: user.id,
      currency: CRYPTO_CURRENCY,
      requestedAmount: "0.01",
      idempotencyKey: crypto.randomUUID(),
    });

    await expect(cancelDeposit(deposit.id, other.id)).rejects.toThrow(DepositError);

    const cancelled = await cancelDeposit(deposit.id, user.id);
    expect(cancelled.status).toBe("CANCELLED");

    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(sql`${ledgerEntries.metadata}->>'depositId' = ${deposit.id}`);
    expect(entries).toHaveLength(0);
  });
});
