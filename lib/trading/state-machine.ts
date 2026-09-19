import { and, eq, lte, sql } from "drizzle-orm";
import { compareDecimalStrings } from "@/lib/decimal";
import { db } from "@/lib/db/client";
import { auditLogs, trades } from "@/lib/db/schema";
import type { TradeDirection, TradeStatus } from "@/lib/db/schema";
import { treasuryAccount, userAccount } from "@/lib/ledger/accounts";
import { postLedgerEntryInTx } from "@/lib/ledger/post";
import { getInstrument } from "@/lib/trading/instruments-service";
import { priceAt } from "@/lib/trading/price-engine";

export class TradeError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type Trade = typeof trades.$inferSelect;

export interface PlaceTradeInput {
  userId: string;
  instrumentId: string;
  currency: string;
  direction: TradeDirection;
  durationSeconds: number;
  stakeAmount: string;
  idempotencyKey: string;
}

export async function placeTrade(input: PlaceTradeInput): Promise<Trade> {
  const instrument = await getInstrument(input.instrumentId);
  if (!instrument || !instrument.isActive) {
    throw new TradeError("This instrument is not available.", "instrument_unavailable", 400);
  }
  if (!instrument.allowedDurationsSeconds.includes(input.durationSeconds)) {
    throw new TradeError("That duration isn't available for this instrument.", "invalid_duration", 400);
  }
  if (instrument.minStake && compareDecimalStrings(input.stakeAmount, instrument.minStake) < 0) {
    throw new TradeError(`Minimum stake is ${instrument.minStake}.`, "stake_too_small", 400);
  }
  if (instrument.maxStake && compareDecimalStrings(input.stakeAmount, instrument.maxStake) > 0) {
    throw new TradeError(`Maximum stake is ${instrument.maxStake}.`, "stake_too_large", 400);
  }

  const tradeId = crypto.randomUUID();
  const now = Date.now();
  const entryPrice = priceAt(input.instrumentId, now);
  const expiresAt = new Date(now + input.durationSeconds * 1000);

  return db.transaction(async (tx) => {
    const lockResult = await postLedgerEntryInTx(tx, {
      idempotencyKey: input.idempotencyKey,
      scope: "ledger.trade_stake_lock",
      debitAccount: userAccount(input.userId, input.currency, "AVAILABLE"),
      creditAccount: userAccount(input.userId, input.currency, "LOCKED"),
      amount: input.stakeAmount,
      currency: input.currency,
      transactionType: "TRADE_STAKE_LOCK",
      reference: `trade:${tradeId}`,
      actorUserId: input.userId,
      metadata: { tradeId, instrumentId: input.instrumentId },
    });

    const [created] = await tx
      .insert(trades)
      .values({
        id: tradeId,
        userId: input.userId,
        instrumentId: input.instrumentId,
        currency: input.currency,
        direction: input.direction,
        durationSeconds: input.durationSeconds,
        stakeAmount: input.stakeAmount,
        payoutPercent: instrument.payoutPercent,
        entryPrice: entryPrice.toFixed(8),
        expiresAt,
        stakeLockLedgerEntryId: lockResult.entryId,
      })
      .returning();
    if (!created) throw new Error("Failed to create trade.");
    return created;
  });
}

/**
 * Idempotent and forgiving on purpose — called opportunistically and
 * redundantly from many read paths (trade list, wallet summary, trade
 * placement), so "already settled" or "not due yet" is the expected
 * common case here, not an error. Returns the current row rather than
 * throwing, unlike approveWithdrawal/rejectWithdrawal (those are explicit
 * human actions where "already approved" is meaningful feedback).
 */
export async function settleTrade(tradeId: string): Promise<Trade> {
  return db.transaction(async (tx) => {
    // This row lock is the entire serialization mechanism for concurrent
    // settlement attempts — everything below runs with it held.
    const [trade] = await tx.select().from(trades).where(eq(trades.id, tradeId)).for("update");
    if (!trade) {
      throw new TradeError("Trade not found.", "not_found", 404);
    }
    if (trade.status !== "OPEN" || trade.expiresAt.getTime() > Date.now()) {
      return trade;
    }

    // Always the expiry instant, never "now" — priceAt() is a pure
    // function of time, so settling late still gives the exact price at
    // the exact moment that mattered, not an approximation. Rounded to
    // the same 8-decimal precision entryPrice was stored at — comparing
    // a fresh full-precision value against an already-rounded one would
    // make a genuine tie (same price at both instants) almost never
    // register as equal, decided instead by an imperceptible float
    // difference below the platform's own displayed/stored precision.
    const settlementPrice = Number(priceAt(trade.instrumentId, trade.expiresAt.getTime()).toFixed(8));
    const entryPriceNumber = Number(trade.entryPrice);
    const isTie = settlementPrice === entryPriceNumber;
    const isWin =
      !isTie &&
      ((trade.direction === "RISE" && settlementPrice > entryPriceNumber) ||
        (trade.direction === "FALL" && settlementPrice < entryPriceNumber));

    let status: TradeStatus;
    let settlementLedgerEntryId: string;
    let profitLedgerEntryId: string | null = null;
    let refundReason: string | null = null;

    if (isTie) {
      const result = await postLedgerEntryInTx(tx, {
        idempotencyKey: `trade-settle-refund:${tradeId}`,
        scope: "ledger.trade_settle",
        debitAccount: userAccount(trade.userId, trade.currency, "LOCKED"),
        creditAccount: userAccount(trade.userId, trade.currency, "AVAILABLE"),
        amount: trade.stakeAmount,
        currency: trade.currency,
        transactionType: "TRADE_REFUND",
        reference: `trade:${tradeId}`,
        actorUserId: trade.userId,
        metadata: { tradeId, leg: "refund" },
      });
      status = "REFUNDED";
      settlementLedgerEntryId = result.entryId;
      refundReason = "Price unchanged at expiry (push).";
    } else if (isWin) {
      const stakeResult = await postLedgerEntryInTx(tx, {
        idempotencyKey: `trade-settle-stake:${tradeId}`,
        scope: "ledger.trade_settle",
        debitAccount: userAccount(trade.userId, trade.currency, "LOCKED"),
        creditAccount: userAccount(trade.userId, trade.currency, "AVAILABLE"),
        amount: trade.stakeAmount,
        currency: trade.currency,
        transactionType: "TRADE_WIN",
        reference: `trade:${tradeId}`,
        actorUserId: trade.userId,
        metadata: { tradeId, leg: "stake" },
      });

      // Postgres numeric arithmetic, not JS floats — this is the one
      // calculation this feature does, and float rounding here would be
      // a real correctness bug on a real-money platform.
      const [profitRow] = await tx.execute(
        sql`select (${trade.stakeAmount}::numeric * ${trade.payoutPercent}::numeric / 100)::numeric(38,18) as "profitAmount"`,
      );
      const profitAmount = String((profitRow as { profitAmount: string }).profitAmount);

      const profitResult = await postLedgerEntryInTx(tx, {
        idempotencyKey: `trade-settle-profit:${tradeId}`,
        scope: "ledger.trade_settle",
        debitAccount: treasuryAccount(trade.currency),
        creditAccount: userAccount(trade.userId, trade.currency, "AVAILABLE"),
        amount: profitAmount,
        currency: trade.currency,
        transactionType: "TRADE_WIN",
        reference: `trade:${tradeId}`,
        actorUserId: trade.userId,
        metadata: { tradeId, leg: "profit" },
      });

      status = "WON";
      settlementLedgerEntryId = stakeResult.entryId;
      profitLedgerEntryId = profitResult.entryId;
    } else {
      const result = await postLedgerEntryInTx(tx, {
        idempotencyKey: `trade-settle:${tradeId}`,
        scope: "ledger.trade_settle",
        debitAccount: userAccount(trade.userId, trade.currency, "LOCKED"),
        creditAccount: treasuryAccount(trade.currency),
        amount: trade.stakeAmount,
        currency: trade.currency,
        transactionType: "TRADE_LOSS",
        reference: `trade:${tradeId}`,
        actorUserId: trade.userId,
        metadata: { tradeId, leg: "stake" },
      });
      status = "LOST";
      settlementLedgerEntryId = result.entryId;
    }

    const [updated] = await tx
      .update(trades)
      .set({
        status,
        settlementPrice: settlementPrice.toFixed(8),
        settledAt: new Date(),
        settlementLedgerEntryId,
        profitLedgerEntryId,
        refundReason,
        updatedAt: new Date(),
      })
      // The status guard is defense-in-depth alongside the row lock —
      // it can only ever not-match if something upstream is broken, but
      // matches the same style approveWithdrawal uses.
      .where(and(eq(trades.id, tradeId), eq(trades.status, "OPEN")))
      .returning();
    if (!updated) throw new Error("Failed to update trade.");
    return updated;
  });
}

/** Bounds settlement staleness to "next time this user does anything" —
 * called defensively from every authenticated path that reads a user's
 * trades or wallet. No cron/background worker exists in this deployment
 * yet; a user who never returns after placing a trade leaves funds
 * LOCKED until they do. See settleAllDueTrades() for the cron-ready path. */
export async function settleDueTradesForUser(userId: string): Promise<Trade[]> {
  const due = await db
    .select({ id: trades.id })
    .from(trades)
    .where(and(eq(trades.userId, userId), eq(trades.status, "OPEN"), lte(trades.expiresAt, new Date())));

  const settled: Trade[] = [];
  for (const { id } of due) {
    settled.push(await settleTrade(id));
  }
  return settled;
}

/** User-agnostic — built now but wired to nothing yet (see
 * app/api/trading/internal/settle-due/route.ts). Exists so that wiring a
 * real cron, once a deployment target is chosen, is a one-line job. */
export async function settleAllDueTrades(limit = 100): Promise<number> {
  const due = await db
    .select({ id: trades.id })
    .from(trades)
    .where(and(eq(trades.status, "OPEN"), lte(trades.expiresAt, new Date())))
    .limit(limit);

  for (const { id } of due) {
    await settleTrade(id);
  }
  return due.length;
}

export interface VoidTradeInput {
  tradeId: string;
  adminUserId: string;
  reason: string;
  ip: string | null;
}

/** Any admin, not a quorum — matches rejectWithdrawal's "stopping
 * something bad should be cheap" precedent. Only from OPEN. */
export async function voidTrade(input: VoidTradeInput): Promise<Trade> {
  return db.transaction(async (tx) => {
    const [trade] = await tx.select().from(trades).where(eq(trades.id, input.tradeId)).for("update");
    if (!trade) {
      throw new TradeError("Trade not found.", "not_found", 404);
    }
    if (trade.status !== "OPEN") {
      throw new TradeError("This trade can no longer be voided.", "invalid_status", 409);
    }

    const result = await postLedgerEntryInTx(tx, {
      idempotencyKey: `trade-void:${input.tradeId}`,
      scope: "ledger.trade_void",
      debitAccount: userAccount(trade.userId, trade.currency, "LOCKED"),
      creditAccount: userAccount(trade.userId, trade.currency, "AVAILABLE"),
      amount: trade.stakeAmount,
      currency: trade.currency,
      transactionType: "TRADE_REFUND",
      reference: `trade:${input.tradeId}`,
      actorUserId: input.adminUserId,
      metadata: { tradeId: input.tradeId, reason: input.reason },
    });

    const [updated] = await tx
      .update(trades)
      .set({
        status: "REFUNDED",
        refundReason: input.reason,
        settledAt: new Date(),
        settlementLedgerEntryId: result.entryId,
        updatedAt: new Date(),
      })
      .where(eq(trades.id, input.tradeId))
      .returning();
    if (!updated) throw new Error("Failed to update trade.");

    await tx.insert(auditLogs).values({
      actorUserId: input.adminUserId,
      action: "trade.voided",
      targetType: "trade",
      targetId: input.tradeId,
      before: { status: "OPEN" },
      after: { status: "REFUNDED", reason: input.reason },
      ip: input.ip,
      correlationId: crypto.randomUUID(),
    });

    return updated;
  });
}
