import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import type { DbTransaction } from "@/lib/db/client";
import { auditLogs, deposits } from "@/lib/db/schema";
import type { DepositMethod } from "@/lib/db/schema";
import { treasuryAccount, userAccount } from "@/lib/ledger/accounts";
import { postLedgerEntryInTx } from "@/lib/ledger/post";
import { getMpesaProvider } from "@/lib/mpesa/provider";
import { listPlatformWallets } from "@/lib/platform-wallets/service";
import { createDepositWithUniqueReferenceCode } from "@/lib/deposits/reference-code";

export class DepositError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type Deposit = typeof deposits.$inferSelect;

const MPESA_DEV_CONFIRM_DELAY_SECONDS = Number(process.env.MPESA_DEV_CONFIRM_DELAY_SECONDS ?? "15");

export interface RequestCryptoDepositInput {
  userId: string;
  currency: string;
  requestedAmount: string;
  idempotencyKey: string;
}

export async function requestCryptoDeposit(input: RequestCryptoDepositInput): Promise<Deposit> {
  const wallets = await listPlatformWallets();
  const wallet = wallets.find((row) => row.currency === input.currency);
  if (!wallet || wallet.kind !== "CRYPTO") {
    throw new DepositError("This currency doesn't support crypto deposits.", "unsupported_currency", 400);
  }
  if (!wallet.address) {
    throw new DepositError(
      "Deposits for this currency aren't configured yet. Try again later.",
      "not_configured",
      400,
    );
  }

  return createDepositWithUniqueReferenceCode((referenceCode) =>
    db
      .insert(deposits)
      .values({
        userId: input.userId,
        currency: input.currency,
        method: "CRYPTO",
        requestedAmount: input.requestedAmount,
        referenceCode,
        // Snapshotted now — a later admin change to the platform address
        // doesn't retroactively change this in-flight request.
        destinationAddress: wallet.address,
        idempotencyKey: input.idempotencyKey,
      })
      .returning()
      .then(([row]) => {
        if (!row) throw new Error("Failed to create deposit.");
        return row;
      }),
  );
}

export interface RequestMobileMoneyDepositInput {
  userId: string;
  requestedAmount: string;
  phone: string;
  idempotencyKey: string;
}

/** M-Pesa pays out in KES only — this isn't a general "any FIAT" check. */
export async function requestMobileMoneyDeposit(input: RequestMobileMoneyDepositInput): Promise<Deposit> {
  const provider = getMpesaProvider();

  return createDepositWithUniqueReferenceCode(async (referenceCode) => {
    const { providerReference } = await provider.initiateStkPush({
      userId: input.userId,
      phone: input.phone,
      amount: input.requestedAmount,
      accountReference: referenceCode,
    });

    const readyToConfirmAt = new Date(Date.now() + MPESA_DEV_CONFIRM_DELAY_SECONDS * 1000);

    const [row] = await db
      .insert(deposits)
      .values({
        userId: input.userId,
        currency: "KES",
        method: "MOBILE_MONEY",
        requestedAmount: input.requestedAmount,
        referenceCode,
        phone: input.phone,
        providerReference,
        readyToConfirmAt,
        idempotencyKey: input.idempotencyKey,
      })
      .returning();
    if (!row) throw new Error("Failed to create deposit.");
    return row;
  });
}

interface ConfirmedLegInput {
  deposit: Deposit;
  confirmedAmount: string;
  actorUserId: string;
}

/** The shared ledger-post/update tail confirmCryptoDeposit and
 * settleMobileMoneyDeposit both need — TREASURY is the real counterparty
 * for money entering the ledger, same pattern as postAdminAdjustment. */
async function postConfirmedDeposit(tx: DbTransaction, input: ConfirmedLegInput) {
  return postLedgerEntryInTx(tx, {
    idempotencyKey: `deposit-confirm:${input.deposit.id}`,
    scope: "ledger.deposit_confirm",
    debitAccount: treasuryAccount(input.deposit.currency),
    creditAccount: userAccount(input.deposit.userId, input.deposit.currency, "AVAILABLE"),
    amount: input.confirmedAmount,
    currency: input.deposit.currency,
    transactionType: "DEPOSIT_CONFIRMED",
    reference: `deposit:${input.deposit.id}`,
    actorUserId: input.actorUserId,
    metadata: { depositId: input.deposit.id, method: input.deposit.method },
  });
}

export interface ConfirmCryptoDepositInput {
  depositId: string;
  adminUserId: string;
  txHash: string;
  confirmedAmount: string;
  ip: string | null;
}

export async function confirmCryptoDeposit(input: ConfirmCryptoDepositInput): Promise<Deposit> {
  return db.transaction(async (tx) => {
    const [deposit] = await tx.select().from(deposits).where(eq(deposits.id, input.depositId)).for("update");
    if (!deposit) {
      throw new DepositError("Deposit not found.", "not_found", 404);
    }
    if (deposit.userId === input.adminUserId) {
      throw new DepositError("You cannot confirm your own deposit.", "self_action", 403);
    }
    if (deposit.method !== "CRYPTO") {
      throw new DepositError("This deposit isn't a crypto deposit.", "invalid_method", 400);
    }
    if (deposit.status !== "PENDING") {
      throw new DepositError("This deposit is not pending.", "invalid_status", 409);
    }

    const result = await postConfirmedDeposit(tx, {
      deposit,
      confirmedAmount: input.confirmedAmount,
      actorUserId: input.adminUserId,
    });

    const [updated] = await tx
      .update(deposits)
      .set({
        status: "CONFIRMED",
        confirmedAmount: input.confirmedAmount,
        txHash: input.txHash,
        settlementLedgerEntryId: result.entryId,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(deposits.id, input.depositId))
      .returning();
    if (!updated) throw new Error("Failed to update deposit.");

    await tx.insert(auditLogs).values({
      actorUserId: input.adminUserId,
      action: "deposit.confirmed",
      targetType: "deposit",
      targetId: input.depositId,
      after: { confirmedAmount: input.confirmedAmount, txHash: input.txHash },
      ip: input.ip,
      correlationId: crypto.randomUUID(),
    });

    return updated;
  });
}

/**
 * Internal — not exposed via any route. System-triggered, so no
 * self-action guard is needed (there's no admin acting). Forgiving,
 * like settleTrade: returns the row unchanged rather than throwing when
 * it's not due yet or already settled, since this is called
 * opportunistically and redundantly from many read paths.
 */
async function settleMobileMoneyDeposit(depositId: string): Promise<Deposit> {
  return db.transaction(async (tx) => {
    const [deposit] = await tx.select().from(deposits).where(eq(deposits.id, depositId)).for("update");
    if (!deposit) {
      throw new DepositError("Deposit not found.", "not_found", 404);
    }
    if (
      deposit.status !== "PENDING" ||
      deposit.method !== "MOBILE_MONEY" ||
      !deposit.readyToConfirmAt ||
      deposit.readyToConfirmAt.getTime() > Date.now()
    ) {
      return deposit;
    }

    // Mobile money's requestedAmount is authoritative (the STK push
    // charges exactly this) — unlike crypto, there's no admin-observed
    // "actual" amount to differ from.
    const result = await postConfirmedDeposit(tx, {
      deposit,
      confirmedAmount: deposit.requestedAmount,
      // No admin is acting here — the depositing user is the closest
      // thing to a real actor for this system-triggered entry, mirroring
      // settleTrade's use of trade.userId (ledgerEntries.actorUserId is
      // NOT NULL, so there's no "system" sentinel to use instead).
      actorUserId: deposit.userId,
    });

    const [updated] = await tx
      .update(deposits)
      .set({
        status: "CONFIRMED",
        confirmedAmount: deposit.requestedAmount,
        settlementLedgerEntryId: result.entryId,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(deposits.id, depositId), eq(deposits.status, "PENDING")))
      .returning();
    if (!updated) throw new Error("Failed to update deposit.");

    await tx.insert(auditLogs).values({
      actorUserId: null,
      action: "deposit.auto_confirmed",
      targetType: "deposit",
      targetId: depositId,
      after: { confirmedAmount: deposit.requestedAmount },
      ip: null,
      correlationId: crypto.randomUUID(),
    });

    return updated;
  });
}

/** Bounds staleness to "next time this user checks" — same shape/
 * limitation as settleDueTradesForUser. Called directly from
 * app/app/deposits/page.tsx and app/app/wallet/page.tsx (both SSR paths
 * that display deposit-derived data), not only from GET /api/deposits. */
export async function settleDueMobileMoneyDepositsForUser(userId: string): Promise<Deposit[]> {
  const due = await db
    .select({ id: deposits.id })
    .from(deposits)
    .where(
      and(
        eq(deposits.userId, userId),
        eq(deposits.status, "PENDING"),
        eq(deposits.method, "MOBILE_MONEY" satisfies DepositMethod),
        lte(deposits.readyToConfirmAt, new Date()),
      ),
    );

  const settled: Deposit[] = [];
  for (const { id } of due) {
    settled.push(await settleMobileMoneyDeposit(id));
  }
  return settled;
}

/** User-agnostic, built now but wired to nothing yet — see
 * app/api/deposits/internal/settle-due/route.ts. Exists so that wiring a
 * real cron, once a deployment target is chosen, is a one-line job. */
export async function settleAllDueDeposits(limit = 100): Promise<number> {
  const due = await db
    .select({ id: deposits.id })
    .from(deposits)
    .where(
      and(
        eq(deposits.status, "PENDING"),
        eq(deposits.method, "MOBILE_MONEY" satisfies DepositMethod),
        lte(deposits.readyToConfirmAt, new Date()),
      ),
    )
    .limit(limit);

  for (const { id } of due) {
    await settleMobileMoneyDeposit(id);
  }
  return due.length;
}

export interface RejectDepositInput {
  depositId: string;
  adminUserId: string;
  reason: string;
  ip: string | null;
}

/** Works for both methods — an admin can reject a stuck/fraudulent
 * mobile-money PENDING too (e.g. "user claims STK failed"). No ledger
 * call at all: structurally simpler than rejectWithdrawal because
 * nothing was ever locked at the pending stage — a direct consequence of
 * DEPOSIT_PENDING staying unused (see lib/db/schema/ledger.ts). */
export async function rejectDeposit(input: RejectDepositInput): Promise<Deposit> {
  return db.transaction(async (tx) => {
    const [deposit] = await tx.select().from(deposits).where(eq(deposits.id, input.depositId)).for("update");
    if (!deposit) {
      throw new DepositError("Deposit not found.", "not_found", 404);
    }
    if (deposit.userId === input.adminUserId) {
      throw new DepositError("You cannot reject your own deposit.", "self_action", 403);
    }
    if (deposit.status !== "PENDING") {
      throw new DepositError("This deposit is not pending.", "invalid_status", 409);
    }

    const [updated] = await tx
      .update(deposits)
      .set({ status: "FAILED", rejectionReason: input.reason, updatedAt: new Date() })
      .where(eq(deposits.id, input.depositId))
      .returning();
    if (!updated) throw new Error("Failed to update deposit.");

    await tx.insert(auditLogs).values({
      actorUserId: input.adminUserId,
      action: "deposit.rejected",
      targetType: "deposit",
      targetId: input.depositId,
      before: { status: "PENDING" },
      after: { status: "FAILED", reason: input.reason },
      ip: input.ip,
      correlationId: crypto.randomUUID(),
    });

    return updated;
  });
}

/** User self-cancel — no ledger call, same reason as rejectDeposit. */
export async function cancelDeposit(depositId: string, userId: string): Promise<Deposit> {
  return db.transaction(async (tx) => {
    const [deposit] = await tx.select().from(deposits).where(eq(deposits.id, depositId)).for("update");
    if (!deposit) {
      throw new DepositError("Deposit not found.", "not_found", 404);
    }
    if (deposit.userId !== userId) {
      throw new DepositError("Not your deposit.", "forbidden", 403);
    }
    if (deposit.status !== "PENDING") {
      throw new DepositError("This deposit can no longer be cancelled.", "invalid_status", 409);
    }

    const [updated] = await tx
      .update(deposits)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(eq(deposits.id, depositId))
      .returning();
    if (!updated) throw new Error("Failed to update deposit.");
    return updated;
  });
}
