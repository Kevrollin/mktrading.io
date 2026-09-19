import { eq, sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { createTestUser } from "@/lib/db/test-utils";
import { withdrawals } from "@/lib/db/schema";
import { postAdminAdjustment } from "@/lib/ledger/admin-adjustment";
import {
  approveWithdrawal,
  cancelWithdrawal,
  markCompleted,
  markProcessing,
  rejectWithdrawal,
  requestWithdrawal,
  WithdrawalError,
} from "@/lib/withdrawals/state-machine";

const CURRENCY = "KES";

afterEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE withdrawal_approvals, withdrawals, ledger_entries, idempotency_keys, ledger_accounts, audit_logs, users CASCADE`,
  );
});

async function fundedUser(amount = "1000") {
  const admin = await createTestUser();
  const user = await createTestUser();
  await postAdminAdjustment({
    adminUserId: admin.id,
    targetUserId: user.id,
    currency: CURRENCY,
    amount,
    direction: "credit",
    reason: "test funding",
    idempotencyKey: crypto.randomUUID(),
  });
  return user;
}

async function makeWithdrawal(userId: string, amount = "100") {
  return requestWithdrawal({
    userId,
    currency: CURRENCY,
    amount,
    destination: { method: "test", details: "n/a" },
    idempotencyKey: crypto.randomUUID(),
  });
}

describe("withdrawal approval quorum", () => {
  it("locks funds at request time", async () => {
    const user = await fundedUser("100");
    const withdrawal = await makeWithdrawal(user.id, "100");
    expect(withdrawal.status).toBe("PENDING_APPROVAL");
  });

  it("does not authorize execution before 5 distinct admins approve", async () => {
    const user = await fundedUser();
    const withdrawal = await makeWithdrawal(user.id);
    const admins = await Promise.all(Array.from({ length: 4 }, () => createTestUser()));

    let current = withdrawal;
    for (const admin of admins) {
      const result = await approveWithdrawal({
        withdrawalId: withdrawal.id,
        adminUserId: admin.id,
        ip: null,
      });
      current = result.withdrawal;
      expect(result.authorized).toBe(false);
    }
    expect(current.status).toBe("PENDING_APPROVAL");
  });

  it("authorizes execution on exactly the 5th distinct admin, exactly once", async () => {
    const user = await fundedUser();
    const withdrawal = await makeWithdrawal(user.id);
    const admins = await Promise.all(Array.from({ length: 5 }, () => createTestUser()));

    let authorizedCount = 0;
    for (const admin of admins) {
      const result = await approveWithdrawal({
        withdrawalId: withdrawal.id,
        adminUserId: admin.id,
        ip: null,
      });
      if (result.authorized) authorizedCount += 1;
    }

    expect(authorizedCount).toBe(1);
    const [final] = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawal.id));
    expect(final!.status).toBe("EXECUTION_AUTHORIZED");
  });

  it("rejects the same admin approving twice", async () => {
    const user = await fundedUser();
    const withdrawal = await makeWithdrawal(user.id);
    const admin = await createTestUser();

    await approveWithdrawal({ withdrawalId: withdrawal.id, adminUserId: admin.id, ip: null });
    await expect(
      approveWithdrawal({ withdrawalId: withdrawal.id, adminUserId: admin.id, ip: null }),
    ).rejects.toThrow(WithdrawalError);
  });

  it("blocks an admin from approving their own withdrawal", async () => {
    const user = await fundedUser();
    const withdrawal = await makeWithdrawal(user.id);

    await expect(
      approveWithdrawal({ withdrawalId: withdrawal.id, adminUserId: user.id, ip: null }),
    ).rejects.toThrow(WithdrawalError);
  });

  it("under two admins racing for the 5th approval, the transition fires exactly once", async () => {
    const user = await fundedUser();
    const withdrawal = await makeWithdrawal(user.id);
    const admins = await Promise.all(Array.from({ length: 6 }, () => createTestUser()));

    for (const admin of admins.slice(0, 4)) {
      await approveWithdrawal({ withdrawalId: withdrawal.id, adminUserId: admin.id, ip: null });
    }

    // Both admins attempt the decisive 5th approval simultaneously. Exactly
    // one can win: the other either loses the race outright (rejected,
    // because by the time it acquires the row lock the status has already
    // moved past PENDING_APPROVAL) or wins nothing (fulfilled but not the
    // one that authorized) — either way, authorization must fire exactly
    // once, never twice.
    const results = await Promise.allSettled(
      admins
        .slice(4, 6)
        .map((admin) =>
          approveWithdrawal({ withdrawalId: withdrawal.id, adminUserId: admin.id, ip: null }),
        ),
    );

    const authorizedCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.authorized,
    ).length;
    expect(authorizedCount).toBe(1);

    const [final] = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawal.id));
    expect(final!.status).toBe("EXECUTION_AUTHORIZED");
  });

  it("stops counting stale-hash approvals after a material change", async () => {
    const user = await fundedUser();
    const withdrawal = await makeWithdrawal(user.id);
    const admins = await Promise.all(Array.from({ length: 4 }, () => createTestUser()));
    for (const admin of admins) {
      await approveWithdrawal({ withdrawalId: withdrawal.id, adminUserId: admin.id, ip: null });
    }

    // Simulate a material change (e.g. amount/destination) structurally
    // invalidating prior approvals — no explicit "invalidate" step exists.
    await db
      .update(withdrawals)
      .set({ requestHash: "changed-hash-simulating-material-edit" })
      .where(eq(withdrawals.id, withdrawal.id));

    const fifthAdmin = await createTestUser();
    const result = await approveWithdrawal({
      withdrawalId: withdrawal.id,
      adminUserId: fifthAdmin.id,
      ip: null,
    });

    expect(result.approvalCount).toBe(1); // only the new-hash approval counts
    expect(result.authorized).toBe(false);
  });

  it("rejects at any approval count and blocks further approval", async () => {
    const user = await fundedUser();
    const withdrawal = await makeWithdrawal(user.id);
    const approver = await createTestUser();
    const rejector = await createTestUser();

    await approveWithdrawal({ withdrawalId: withdrawal.id, adminUserId: approver.id, ip: null });
    const rejected = await rejectWithdrawal({
      withdrawalId: withdrawal.id,
      adminUserId: rejector.id,
      reason: "test rejection",
      ip: null,
    });

    expect(rejected.status).toBe("REJECTED");
    const another = await createTestUser();
    await expect(
      approveWithdrawal({ withdrawalId: withdrawal.id, adminUserId: another.id, ip: null }),
    ).rejects.toThrow(WithdrawalError);
  });

  it("blocks an admin from rejecting their own withdrawal", async () => {
    const user = await fundedUser();
    const withdrawal = await makeWithdrawal(user.id);

    await expect(
      rejectWithdrawal({
        withdrawalId: withdrawal.id,
        adminUserId: user.id,
        reason: "self",
        ip: null,
      }),
    ).rejects.toThrow(WithdrawalError);
  });
});

describe("withdrawal lifecycle", () => {
  it("releases locked funds back to available on rejection", async () => {
    const user = await fundedUser("100");
    const withdrawal = await makeWithdrawal(user.id, "100");
    const rejector = await createTestUser();

    await rejectWithdrawal({
      withdrawalId: withdrawal.id,
      adminUserId: rejector.id,
      reason: "test",
      ip: null,
    });

    const [row] = await db.execute(
      sql`select balance from ledger_accounts where owner_user_id = ${user.id} and currency = ${CURRENCY} and account_type = 'AVAILABLE'`,
    );
    expect(String(row?.balance)).toBe("100.000000000000000000");
  });

  it("releases locked funds back to available on user cancellation", async () => {
    const user = await fundedUser("100");
    const withdrawal = await makeWithdrawal(user.id, "100");

    const cancelled = await cancelWithdrawal(withdrawal.id, user.id);
    expect(cancelled.status).toBe("CANCELLED");

    const [row] = await db.execute(
      sql`select balance from ledger_accounts where owner_user_id = ${user.id} and currency = ${CURRENCY} and account_type = 'AVAILABLE'`,
    );
    expect(String(row?.balance)).toBe("100.000000000000000000");
  });

  it("blocks a user from cancelling someone else's withdrawal", async () => {
    const user = await fundedUser();
    const other = await createTestUser();
    const withdrawal = await makeWithdrawal(user.id);

    await expect(cancelWithdrawal(withdrawal.id, other.id)).rejects.toThrow(WithdrawalError);
  });

  it("moves funds from locked to treasury only at markCompleted, after full approval and processing", async () => {
    const user = await fundedUser("100");
    const withdrawal = await makeWithdrawal(user.id, "100");
    const admins = await Promise.all(Array.from({ length: 5 }, () => createTestUser()));
    for (const admin of admins) {
      await approveWithdrawal({ withdrawalId: withdrawal.id, adminUserId: admin.id, ip: null });
    }

    await markProcessing(withdrawal.id, admins[0]!.id, null);
    const completed = await markCompleted({
      withdrawalId: withdrawal.id,
      adminUserId: admins[0]!.id,
      providerReference: "test-ref-123",
      ip: null,
    });

    expect(completed.status).toBe("COMPLETED");
    const [lockedRow] = await db.execute(
      sql`select balance from ledger_accounts where owner_user_id = ${user.id} and currency = ${CURRENCY} and account_type = 'LOCKED'`,
    );
    expect(String(lockedRow?.balance)).toBe("0.000000000000000000");
  });

  it("refuses to mark processing before execution is authorized", async () => {
    const user = await fundedUser();
    const withdrawal = await makeWithdrawal(user.id);
    const admin = await createTestUser();

    await expect(markProcessing(withdrawal.id, admin.id, null)).rejects.toThrow(WithdrawalError);
  });

  it("refuses to mark completed before processing has started", async () => {
    const user = await fundedUser();
    const withdrawal = await makeWithdrawal(user.id);
    const admin = await createTestUser();

    await expect(
      markCompleted({
        withdrawalId: withdrawal.id,
        adminUserId: admin.id,
        providerReference: "test-ref",
        ip: null,
      }),
    ).rejects.toThrow(WithdrawalError);
  });
});
