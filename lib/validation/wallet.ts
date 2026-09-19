import { z } from "zod";

// Format/sanity only — never used for arithmetic. The actual decimals-
// per-currency check happens against the `currencies` table at the route
// handler, since that's DB-backed reference data a static schema can't see.
export const decimalAmountSchema = z
  .string()
  .trim()
  .regex(/^\d{1,20}(\.\d{1,18})?$/, "Enter a valid amount.")
  .refine((value) => !/^0+(\.0*)?$/.test(value), "Amount must be greater than zero.");

export const currencyCodeSchema = z.string().trim().toUpperCase().min(2).max(10);

// Freeform — no real payout rail exists yet, so this stays a loose
// method/details bag rather than a rail-specific shape.
export const withdrawalDestinationSchema = z
  .object({ method: z.string().trim().min(1).max(50) })
  .catchall(z.unknown());

export const requestWithdrawalSchema = z.object({
  currency: currencyCodeSchema,
  amount: decimalAmountSchema,
  destination: withdrawalDestinationSchema,
});

export const adminAdjustmentSchema = z.object({
  targetUserId: z.string().uuid(),
  currency: currencyCodeSchema,
  amount: decimalAmountSchema,
  direction: z.enum(["credit", "debit"]),
  reason: z.string().trim().min(3).max(500),
  code: z.string().trim().min(6).max(10),
});

// Admin approval actions require a fresh MFA code specifically — never the
// password branch that lib/auth/step-up.ts also supports for self-service
// downgrades. Only `code` is accepted here, on purpose.
export const stepUpCodeSchema = z.object({
  code: z.string().trim().min(6).max(10),
});

export const rejectWithdrawalSchema = z.object({
  code: z.string().trim().min(6).max(10),
  reason: z.string().trim().min(3).max(500),
});

export const markCompletedSchema = z.object({
  code: z.string().trim().min(6).max(10),
  providerReference: z.string().trim().min(1).max(200),
});
