import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { createTestUser } from "@/lib/db/test-utils";
import { getOrCreateAccount, treasuryAccount, userAccount, type AccountRef } from "@/lib/ledger/accounts";
import { postAdminAdjustment } from "@/lib/ledger/admin-adjustment";
import { InsufficientFundsError } from "@/lib/ledger/post";

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

describe("postAdminAdjustment", () => {
  it("credits a user against treasury as the real counterparty", async () => {
    const admin = await createTestUser();
    const target = await createTestUser();

    await postAdminAdjustment({
      adminUserId: admin.id,
      targetUserId: target.id,
      currency: CURRENCY,
      amount: "250",
      direction: "credit",
      reason: "test credit",
      idempotencyKey: crypto.randomUUID(),
    });

    const userAvailableId = await accountId(userAccount(target.id, CURRENCY, "AVAILABLE"));
    const treasuryId = await accountId(treasuryAccount(CURRENCY));
    expect(await balanceOf(userAvailableId)).toBe("250.000000000000000000");
    expect(await balanceOf(treasuryId)).toBe("-250.000000000000000000");
  });

  it("debits a user back to treasury and rejects when funds are insufficient", async () => {
    const admin = await createTestUser();
    const target = await createTestUser();

    await postAdminAdjustment({
      adminUserId: admin.id,
      targetUserId: target.id,
      currency: CURRENCY,
      amount: "100",
      direction: "credit",
      reason: "seed balance",
      idempotencyKey: crypto.randomUUID(),
    });

    await postAdminAdjustment({
      adminUserId: admin.id,
      targetUserId: target.id,
      currency: CURRENCY,
      amount: "40",
      direction: "debit",
      reason: "test debit",
      idempotencyKey: crypto.randomUUID(),
    });

    const userAvailableId = await accountId(userAccount(target.id, CURRENCY, "AVAILABLE"));
    expect(await balanceOf(userAvailableId)).toBe("60.000000000000000000");

    await expect(
      postAdminAdjustment({
        adminUserId: admin.id,
        targetUserId: target.id,
        currency: CURRENCY,
        amount: "1000",
        direction: "debit",
        reason: "overdraw attempt",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(InsufficientFundsError);

    expect(await balanceOf(userAvailableId)).toBe("60.000000000000000000");
  });
});
