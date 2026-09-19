import { z } from "zod";
import { currencyCodeSchema, decimalAmountSchema, stepUpCodeSchema } from "@/lib/validation/wallet";

export const requestCryptoDepositSchema = z.object({
  currency: currencyCodeSchema,
  requestedAmount: decimalAmountSchema,
});

// Currency is implicit (KES) — M-Pesa pays out in KES only, so it's
// never client-supplied here. Phone gets the same loose validation
// users.phone already has elsewhere in this codebase (no Kenya-specific
// regex — a documented limitation, not invented here).
export const requestMobileMoneyDepositSchema = z.object({
  requestedAmount: decimalAmountSchema,
  phone: z.string().trim().min(9).max(15),
});

export const confirmCryptoDepositSchema = stepUpCodeSchema.extend({
  txHash: z.string().trim().min(4).max(200),
  confirmedAmount: decimalAmountSchema,
});

export const rejectDepositSchema = z.object({
  code: z.string().trim().min(6).max(10),
  reason: z.string().trim().min(3).max(500),
});
