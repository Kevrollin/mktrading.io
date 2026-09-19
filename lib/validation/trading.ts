import { z } from "zod";
import { currencyCodeSchema, decimalAmountSchema, stepUpCodeSchema } from "@/lib/validation/wallet";

export const placeTradeSchema = z.object({
  instrumentId: z.string().trim().min(1).max(100),
  currency: currencyCodeSchema,
  direction: z.enum(["RISE", "FALL"]),
  durationSeconds: z.coerce.number().int().positive(),
  stakeAmount: decimalAmountSchema,
});

export const updateInstrumentSchema = stepUpCodeSchema.extend({
  // Kept as decimal strings all the way to the DB, same as every other
  // money-adjacent field in this codebase — never a JS number.
  payoutPercent: decimalAmountSchema.optional(),
  isActive: z.boolean().optional(),
  allowedDurationsSeconds: z.array(z.coerce.number().int().positive()).min(1).optional(),
  minStake: decimalAmountSchema.optional(),
  maxStake: decimalAmountSchema.optional(),
});

export const voidTradeSchema = z.object({
  code: z.string().trim().min(6).max(10),
  reason: z.string().trim().min(3).max(500),
});
