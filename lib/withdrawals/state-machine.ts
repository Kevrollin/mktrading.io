import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLogs, withdrawalApprovals, withdrawals } from "@/lib/db/schema";
import type { WithdrawalStatus } from "@/lib/db/schema";
import { treasuryAccount, userAccount } from "@/lib/ledger/accounts";
import { postLedgerEntryInTx } from "@/lib/ledger/post";
import { computeRequestHash } from "@/lib/withdrawals/request-hash";

export class WithdrawalError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type Withdrawal = typeof withdrawals.$inferSelect;

const REJECTABLE_STATUSES: WithdrawalStatus[] = [
  "PENDING_REVIEW",
  "PENDING_APPROVAL",
  "EXECUTION_AUTHORIZED",
  "PROCESSING",
];
const CANCELLABLE_STATUSES: WithdrawalStatus[] = ["PENDING_REVIEW", "PENDING_APPROVAL"];

export interface RequestWithdrawalInput {
  userId: string;
  currency: string;
  amount: string;
  destination: Record<string, unknown>;
  idempotencyKey: string;
}

export async function requestWithdrawal(input: RequestWithdrawalInput): Promise<Withdrawal> {
  const withdrawalId = crypto.randomUUID();
  const requestHash = computeRequestHash({
    withdrawalId,
    userId: input.userId,
    currency: input.currency,
    amount: input.amount,
    destination: input.destination,
  });

  return db.transaction(async (tx) => {
    const lockResult = await postLedgerEntryInTx(tx, {
      idempotencyKey: input.idempotencyKey,
      scope: "ledger.withdrawal_lock",
      debitAccount: userAccount(input.userId, input.currency, "AVAILABLE"),
      creditAccount: userAccount(input.userId, input.currency, "LOCKED"),
      amount: input.amount,
      currency: input.currency,
      transactionType: "WITHDRAWAL_PENDING",
      reference: `withdrawal:${withdrawalId}`,
      actorUserId: input.userId,
      metadata: { withdrawalId },
    });

    // KYC doesn't exist yet — PENDING_REVIEW auto-passes straight through
    // to PENDING_APPROVAL here. This is a documented gap, not a silently
    // skipped check: there is genuinely no review step to perform yet.
    const [created] = await tx
      .insert(withdrawals)
      .values({
        id: withdrawalId,
        userId: input.userId,
        currency: input.currency,
        amount: input.amount,
        destination: input.destination,
        status: "PENDING_APPROVAL",
        requestHash,
        lockLedgerEntryId: lockResult.entryId,
      })
      .returning();
    if (!created) throw new Error("Failed to create withdrawal.");

    return created;
  });
}

export interface ApproveWithdrawalInput {
  withdrawalId: string;
  adminUserId: string;
  ip: string | null;
}

export interface ApproveWithdrawalResult {
  withdrawal: Withdrawal;
  approvalCount: number;
  authorized: boolean;
}

export async function approveWithdrawal(
  input: ApproveWithdrawalInput,
): Promise<ApproveWithdrawalResult> {
  return db.transaction(async (tx) => {
    // This row lock is the entire serialization mechanism for concurrent
    // approvals on this withdrawal — everything below runs with it held.
    const [withdrawal] = await tx
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.id, input.withdrawalId))
      .for("update");
    if (!withdrawal) {
      throw new WithdrawalError("Withdrawal not found.", "not_found", 404);
    }
    if (withdrawal.userId === input.adminUserId) {
      throw new WithdrawalError("You cannot approve your own withdrawal.", "self_approval", 403);
    }
    if (withdrawal.status !== "PENDING_APPROVAL") {
      throw new WithdrawalError("This withdrawal is not pending approval.", "invalid_status", 409);
    }

    const [inserted] = await tx
      .insert(withdrawalApprovals)
      .values({
        withdrawalId: withdrawal.id,
        adminUserId: input.adminUserId,
        requestHash: withdrawal.requestHash,
      })
      .onConflictDoNothing()
      .returning();
    if (!inserted) {
      throw new WithdrawalError(
        "You have already approved this withdrawal.",
        "already_approved",
        409,
      );
    }

    // Only approvals whose snapshotted hash matches the withdrawal's
    // CURRENT hash count — a future material change (amount/destination)
    // would make prior approvals stop counting automatically.
    const [{ approvalCount }] = await tx
      .select({ approvalCount: sql<number>`count(distinct ${withdrawalApprovals.adminUserId})::int` })
      .from(withdrawalApprovals)
      .where(
        and(
          eq(withdrawalApprovals.withdrawalId, withdrawal.id),
          eq(withdrawalApprovals.requestHash, withdrawal.requestHash),
        ),
      );

    const authorized = approvalCount >= withdrawal.approvalsRequiredCount;
    let current = withdrawal;

    if (authorized) {
      // Can only be reached inside the transaction that just inserted the
      // Nth distinct row, since the row lock above serialized every
      // concurrent approval attempt through this same path.
      const [updated] = await tx
        .update(withdrawals)
        .set({ status: "EXECUTION_AUTHORIZED", updatedAt: new Date() })
        .where(and(eq(withdrawals.id, withdrawal.id), eq(withdrawals.status, "PENDING_APPROVAL")))
        .returning();
      if (updated) current = updated;
    }

    await tx.insert(auditLogs).values({
      actorUserId: input.adminUserId,
      action: authorized ? "withdrawal.approved.authorized" : "withdrawal.approved",
      targetType: "withdrawal",
      targetId: withdrawal.id,
      after: { approvalCount, status: current.status },
      ip: input.ip,
      correlationId: crypto.randomUUID(),
    });

    return { withdrawal: current, approvalCount, authorized };
  });
}

export interface RejectWithdrawalInput {
  withdrawalId: string;
  adminUserId: string;
  reason: string;
  ip: string | null;
}

/** Single-admin, not 5-of-5 — stopping a bad payout should be cheap;
 * requiring unanimity to reject would be a real regression. */
export async function rejectWithdrawal(input: RejectWithdrawalInput): Promise<Withdrawal> {
  return db.transaction(async (tx) => {
    const [withdrawal] = await tx
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.id, input.withdrawalId))
      .for("update");
    if (!withdrawal) throw new WithdrawalError("Withdrawal not found.", "not_found", 404);
    if (withdrawal.userId === input.adminUserId) {
      throw new WithdrawalError("You cannot reject your own withdrawal.", "self_approval", 403);
    }
    if (!REJECTABLE_STATUSES.includes(withdrawal.status as WithdrawalStatus)) {
      throw new WithdrawalError("This withdrawal can no longer be rejected.", "invalid_status", 409);
    }

    const releaseResult = await postLedgerEntryInTx(tx, {
      idempotencyKey: `withdrawal-release:${withdrawal.id}`,
      scope: "ledger.withdrawal_release",
      debitAccount: userAccount(withdrawal.userId, withdrawal.currency, "LOCKED"),
      creditAccount: userAccount(withdrawal.userId, withdrawal.currency, "AVAILABLE"),
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      transactionType: "WITHDRAWAL_REJECTED",
      reference: `withdrawal:${withdrawal.id}`,
      actorUserId: input.adminUserId,
      metadata: { withdrawalId: withdrawal.id, reason: input.reason },
    });

    const [updated] = await tx
      .update(withdrawals)
      .set({
        status: "REJECTED",
        rejectionReason: input.reason,
        settlementLedgerEntryId: releaseResult.entryId,
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, withdrawal.id))
      .returning();
    if (!updated) throw new Error("Failed to update withdrawal.");

    await tx.insert(auditLogs).values({
      actorUserId: input.adminUserId,
      action: "withdrawal.rejected",
      targetType: "withdrawal",
      targetId: withdrawal.id,
      before: { status: withdrawal.status },
      after: { status: "REJECTED", reason: input.reason },
      ip: input.ip,
      correlationId: crypto.randomUUID(),
    });

    return updated;
  });
}

export async function cancelWithdrawal(withdrawalId: string, userId: string): Promise<Withdrawal> {
  return db.transaction(async (tx) => {
    const [withdrawal] = await tx
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.id, withdrawalId))
      .for("update");
    if (!withdrawal) throw new WithdrawalError("Withdrawal not found.", "not_found", 404);
    if (withdrawal.userId !== userId) {
      throw new WithdrawalError("Not your withdrawal.", "forbidden", 403);
    }
    if (!CANCELLABLE_STATUSES.includes(withdrawal.status as WithdrawalStatus)) {
      throw new WithdrawalError(
        "This withdrawal can no longer be cancelled.",
        "invalid_status",
        409,
      );
    }

    const releaseResult = await postLedgerEntryInTx(tx, {
      idempotencyKey: `withdrawal-release:${withdrawal.id}`,
      scope: "ledger.withdrawal_release",
      debitAccount: userAccount(withdrawal.userId, withdrawal.currency, "LOCKED"),
      creditAccount: userAccount(withdrawal.userId, withdrawal.currency, "AVAILABLE"),
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      transactionType: "WITHDRAWAL_REJECTED",
      reference: `withdrawal:${withdrawal.id}`,
      actorUserId: userId,
      metadata: { withdrawalId: withdrawal.id, reason: "cancelled_by_user" },
    });

    const [updated] = await tx
      .update(withdrawals)
      .set({
        status: "CANCELLED",
        settlementLedgerEntryId: releaseResult.entryId,
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, withdrawal.id))
      .returning();
    if (!updated) throw new Error("Failed to update withdrawal.");
    return updated;
  });
}

export async function markProcessing(
  withdrawalId: string,
  adminUserId: string,
  ip: string | null,
): Promise<Withdrawal> {
  return db.transaction(async (tx) => {
    const [withdrawal] = await tx
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.id, withdrawalId))
      .for("update");
    if (!withdrawal) throw new WithdrawalError("Withdrawal not found.", "not_found", 404);
    if (withdrawal.status !== "EXECUTION_AUTHORIZED") {
      throw new WithdrawalError(
        "This withdrawal is not authorized for execution.",
        "invalid_status",
        409,
      );
    }

    const [updated] = await tx
      .update(withdrawals)
      .set({ status: "PROCESSING", updatedAt: new Date() })
      .where(eq(withdrawals.id, withdrawalId))
      .returning();
    if (!updated) throw new Error("Failed to update withdrawal.");

    await tx.insert(auditLogs).values({
      actorUserId: adminUserId,
      action: "withdrawal.processing",
      targetType: "withdrawal",
      targetId: withdrawalId,
      before: { status: "EXECUTION_AUTHORIZED" },
      after: { status: "PROCESSING" },
      ip,
      correlationId: crypto.randomUUID(),
    });

    return updated;
  });
}

export interface MarkCompletedInput {
  withdrawalId: string;
  adminUserId: string;
  providerReference: string;
  ip: string | null;
}

/** The only point funds actually leave LOCKED — as late as possible,
 * only on a human's explicit confirmation, never automatic. */
export async function markCompleted(input: MarkCompletedInput): Promise<Withdrawal> {
  return db.transaction(async (tx) => {
    const [withdrawal] = await tx
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.id, input.withdrawalId))
      .for("update");
    if (!withdrawal) throw new WithdrawalError("Withdrawal not found.", "not_found", 404);
    if (withdrawal.status !== "PROCESSING") {
      throw new WithdrawalError(
        "This withdrawal is not currently processing.",
        "invalid_status",
        409,
      );
    }

    const settlementResult = await postLedgerEntryInTx(tx, {
      idempotencyKey: `withdrawal-settle:${withdrawal.id}`,
      scope: "ledger.withdrawal_settle",
      debitAccount: userAccount(withdrawal.userId, withdrawal.currency, "LOCKED"),
      creditAccount: treasuryAccount(withdrawal.currency),
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      // Transaction-type value, distinct from the (same-named) status —
      // posted here at final completion, not at the earlier
      // APPROVED/EXECUTION_AUTHORIZED status transition.
      transactionType: "WITHDRAWAL_APPROVED",
      reference: `withdrawal:${withdrawal.id}`,
      actorUserId: input.adminUserId,
      metadata: { withdrawalId: withdrawal.id, providerReference: input.providerReference },
    });

    const [updated] = await tx
      .update(withdrawals)
      .set({
        status: "COMPLETED",
        providerReference: input.providerReference,
        settlementLedgerEntryId: settlementResult.entryId,
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, withdrawal.id))
      .returning();
    if (!updated) throw new Error("Failed to update withdrawal.");

    await tx.insert(auditLogs).values({
      actorUserId: input.adminUserId,
      action: "withdrawal.completed",
      targetType: "withdrawal",
      targetId: withdrawal.id,
      before: { status: "PROCESSING" },
      after: { status: "COMPLETED", providerReference: input.providerReference },
      ip: input.ip,
      correlationId: crypto.randomUUID(),
    });

    return updated;
  });
}
