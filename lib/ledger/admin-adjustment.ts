import { treasuryAccount, userAccount } from "@/lib/ledger/accounts";
import { postLedgerEntry, type PostLedgerEntryResult } from "@/lib/ledger/post";

export type AdjustmentDirection = "credit" | "debit";

export interface PostAdminAdjustmentInput {
  adminUserId: string;
  targetUserId: string;
  currency: string;
  amount: string;
  direction: AdjustmentDirection;
  reason: string;
  idempotencyKey: string;
}

/** The only way money enters the ledger in this milestone — no real
 * deposit rail exists yet. Double-entry: TREASURY is the real
 * counterparty, never a value conjured from nothing. */
export async function postAdminAdjustment(
  input: PostAdminAdjustmentInput,
): Promise<PostLedgerEntryResult> {
  const userAvailable = userAccount(input.targetUserId, input.currency, "AVAILABLE");
  const treasury = treasuryAccount(input.currency);

  const [debitAccount, creditAccount] =
    input.direction === "credit" ? [treasury, userAvailable] : [userAvailable, treasury];

  return postLedgerEntry({
    idempotencyKey: input.idempotencyKey,
    scope: "ledger.admin_adjustment",
    debitAccount,
    creditAccount,
    amount: input.amount,
    currency: input.currency,
    transactionType: "ADMIN_ADJUSTMENT",
    reference: `admin-adjustment:${input.idempotencyKey}`,
    actorUserId: input.adminUserId,
    metadata: {
      targetUserId: input.targetUserId,
      reason: input.reason,
      direction: input.direction,
    },
  });
}
