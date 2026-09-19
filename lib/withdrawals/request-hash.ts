import { createHash } from "node:crypto";

export interface RequestHashInput {
  withdrawalId: string;
  userId: string;
  currency: string;
  amount: string;
  destination: unknown;
}

/** Deliberately excludes status/timestamps — only amount/destination are
 * "material" to what's being authorized. If either ever changes, the
 * withdrawal's stored hash changes too, and every existing approval row
 * (which snapshots the hash it was approved against) stops counting
 * toward quorum automatically — no explicit "invalidate" step needed. */
export function computeRequestHash(input: RequestHashInput): string {
  const normalized = JSON.stringify({
    withdrawalId: input.withdrawalId,
    userId: input.userId,
    currency: input.currency,
    amount: input.amount,
    destination: input.destination,
  });
  return createHash("sha256").update(normalized).digest("hex");
}
