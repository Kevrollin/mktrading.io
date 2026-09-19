import { eq, or, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { createTestUser } from "@/lib/db/test-utils";
import { ledgerEntries, trades } from "@/lib/db/schema";
import { getOrCreateAccount, userAccount, type AccountRef } from "@/lib/ledger/accounts";
import { postAdminAdjustment } from "@/lib/ledger/admin-adjustment";
import { priceAt } from "@/lib/trading/price-engine";
import {
  placeTrade,
  settleDueTradesForUser,
  settleTrade,
  TradeError,
  voidTrade,
} from "@/lib/trading/state-machine";

const CURRENCY = "KES";
const INSTRUMENT_ID = "pulse-index";

// Other *.test.ts files sharing this DB TRUNCATE ... users CASCADE for
// their own cleanup, and this shared test DB has no per-file isolation
// (fileParallelism: false, same Postgres instance) — that cascades into
// instruments too via its nullable updated_by_user_id FK, regardless of
// which file happens to run first. Re-seeding here (matching
// supabase/seed.sql) makes this file self-sufficient rather than
// depending on run order.
beforeEach(async () => {
  await db.execute(sql`
    insert into "instruments" ("id", "symbol", "name", "category", "is_active", "payout_percent", "allowed_durations_seconds", "min_stake", "max_stake")
    values
      ('pulse-index', 'PULS', 'Pulse Index', 'rapid', true, 85.00, '{30,60,300}', 1, 1000),
      ('nova-index', 'NOVA', 'Nova Index', 'rapid', true, 85.00, '{30,60,300}', 1, 1000),
      ('tidal-range', 'TIDE', 'Tidal Range', 'range-bound', true, 85.00, '{60,300}', 1, 1000),
      ('ember-index', 'EMBR', 'Ember Index', 'standard', true, 85.00, '{60,300}', 1, 1000),
      ('quartz-index', 'QRTZ', 'Quartz Index', 'standard', false, 85.00, '{60,300}', 1, 1000),
      ('drift-index', 'DRFT', 'Drift Index', 'range-bound', true, 85.00, '{60,300}', 1, 1000)
    on conflict ("id") do nothing;
  `);
});

afterEach(async () => {
  // Deliberately NOT truncating users here (unlike other *.test.ts
  // files) — TRUNCATE ... users CASCADE would cascade into instruments
  // too via its nullable updated_by_user_id FK. createTestUser() always
  // uses a unique email, so leaving users un-truncated across tests in
  // this file causes no correctness issue, just a few extra rows.
  await db.execute(sql`TRUNCATE TABLE trades, ledger_entries, idempotency_keys, ledger_accounts, audit_logs CASCADE`);
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

function forcedEntryPriceFor(direction: "RISE" | "FALL", outcome: "WIN" | "LOSS"): string {
  const veryHigh = "999999999.00000000";
  const veryLow = "-999999999.00000000";
  if (direction === "RISE") return outcome === "WIN" ? veryLow : veryHigh;
  return outcome === "WIN" ? veryHigh : veryLow;
}

/** Places a trade through the real state machine (so the stake is really
 * locked in the ledger), then forces a deterministic outcome by directly
 * rewriting entryPrice/expiresAt — the same "direct row manipulation to
 * simulate a scenario" technique used in withdrawals/state-machine.test.ts
 * for its stale-hash test. This tests settlement/ledger correctness
 * without depending on the synthetic feed's unpredictable real-time
 * movement (that's price-engine.test.ts's job). */
async function placeAndForceOutcome(input: {
  userId: string;
  direction: "RISE" | "FALL";
  outcome: "WIN" | "LOSS" | "TIE";
  stakeAmount?: string;
}): Promise<string> {
  const trade = await placeTrade({
    userId: input.userId,
    instrumentId: INSTRUMENT_ID,
    currency: CURRENCY,
    direction: input.direction,
    durationSeconds: 30,
    stakeAmount: input.stakeAmount ?? "10",
    idempotencyKey: crypto.randomUUID(),
  });

  // Must be strictly after placedAt (a CHECK constraint) but still in
  // the past by the time settleTrade runs — 1ms after placedAt satisfies
  // both, since even the fastest possible follow-up call happens later.
  const expiresAt = new Date(trade.placedAt.getTime() + 1);
  const entryPrice =
    input.outcome === "TIE"
      ? priceAt(INSTRUMENT_ID, expiresAt.getTime()).toFixed(8)
      : forcedEntryPriceFor(input.direction, input.outcome);

  await db.update(trades).set({ entryPrice, expiresAt }).where(eq(trades.id, trade.id));
  return trade.id;
}

async function accountId(ref: AccountRef): Promise<string> {
  return db.transaction((tx) => getOrCreateAccount(tx, ref));
}

async function balanceOf(id: string): Promise<string> {
  const [row] = await db.execute(sql`select balance from ledger_accounts where id = ${id}`);
  return String(row?.balance ?? "0");
}

async function reconciledBalance(id: string): Promise<string> {
  const [row] = await db
    .select({
      balance: sql<string>`coalesce(sum(case when ${ledgerEntries.creditAccountId} = ${id} then ${ledgerEntries.amount} else 0 end), 0) - coalesce(sum(case when ${ledgerEntries.debitAccountId} = ${id} then ${ledgerEntries.amount} else 0 end), 0)`,
    })
    .from(ledgerEntries)
    .where(or(eq(ledgerEntries.creditAccountId, id), eq(ledgerEntries.debitAccountId, id)));
  return row?.balance ?? "0";
}

describe("placeTrade", () => {
  it("locks the stake and snapshots the instrument's current payout percent", async () => {
    const user = await fundedUser();
    const trade = await placeTrade({
      userId: user.id,
      instrumentId: INSTRUMENT_ID,
      currency: CURRENCY,
      direction: "RISE",
      durationSeconds: 30,
      stakeAmount: "50",
      idempotencyKey: crypto.randomUUID(),
    });

    expect(trade.status).toBe("OPEN");
    expect(trade.payoutPercent).toBe("85.00");

    const lockedId = await accountId(userAccount(user.id, CURRENCY, "LOCKED"));
    expect(await balanceOf(lockedId)).toBe("50.000000000000000000");
  });

  it("rejects an unavailable duration for the instrument", async () => {
    const user = await fundedUser();
    await expect(
      placeTrade({
        userId: user.id,
        instrumentId: INSTRUMENT_ID,
        currency: CURRENCY,
        direction: "RISE",
        durationSeconds: 9999,
        stakeAmount: "10",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(TradeError);
  });

  it("rejects a stake below the instrument's minimum", async () => {
    const user = await fundedUser();
    await expect(
      placeTrade({
        userId: user.id,
        instrumentId: INSTRUMENT_ID,
        currency: CURRENCY,
        direction: "RISE",
        durationSeconds: 30,
        stakeAmount: "0.5",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(TradeError);
  });

  it("rejects a stake above the instrument's maximum", async () => {
    const user = await fundedUser("5000");
    await expect(
      placeTrade({
        userId: user.id,
        instrumentId: INSTRUMENT_ID,
        currency: CURRENCY,
        direction: "RISE",
        durationSeconds: 30,
        stakeAmount: "5000",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow(TradeError);
  });
});

describe("settleTrade outcomes", () => {
  it("WIN moves the stake back to AVAILABLE and pays profit from TREASURY", async () => {
    const user = await fundedUser();
    const tradeId = await placeAndForceOutcome({ userId: user.id, direction: "RISE", outcome: "WIN" });

    const settled = await settleTrade(tradeId);
    expect(settled.status).toBe("WON");

    const availableId = await accountId(userAccount(user.id, CURRENCY, "AVAILABLE"));
    const lockedId = await accountId(userAccount(user.id, CURRENCY, "LOCKED"));
    // 1000 funded - 10 staked + 10 returned + 8.5 profit (85% of 10) = 1008.5
    expect(await balanceOf(availableId)).toBe("1008.500000000000000000");
    expect(await balanceOf(lockedId)).toBe("0.000000000000000000");
    expect(await reconciledBalance(availableId)).toBe(await balanceOf(availableId));
  });

  it("LOSS moves the stake to TREASURY, leaving AVAILABLE unaffected", async () => {
    const user = await fundedUser();
    const tradeId = await placeAndForceOutcome({ userId: user.id, direction: "RISE", outcome: "LOSS" });

    const settled = await settleTrade(tradeId);
    expect(settled.status).toBe("LOST");

    const availableId = await accountId(userAccount(user.id, CURRENCY, "AVAILABLE"));
    const lockedId = await accountId(userAccount(user.id, CURRENCY, "LOCKED"));
    expect(await balanceOf(availableId)).toBe("990.000000000000000000");
    expect(await balanceOf(lockedId)).toBe("0.000000000000000000");
  });

  it("a tie refunds the stake with no win or loss", async () => {
    const user = await fundedUser();
    const tradeId = await placeAndForceOutcome({ userId: user.id, direction: "RISE", outcome: "TIE" });

    const settled = await settleTrade(tradeId);
    expect(settled.status).toBe("REFUNDED");
    expect(settled.refundReason).toBeTruthy();

    const availableId = await accountId(userAccount(user.id, CURRENCY, "AVAILABLE"));
    expect(await balanceOf(availableId)).toBe("1000.000000000000000000");
  });

  it("computes profit with exact decimal arithmetic, not float rounding", async () => {
    const user = await fundedUser();
    const tradeId = await placeAndForceOutcome({
      userId: user.id,
      direction: "RISE",
      outcome: "WIN",
      stakeAmount: "33.33",
    });

    await settleTrade(tradeId);
    const [row] = await db.select().from(trades).where(eq(trades.id, tradeId));
    // 33.33 * 85 / 100 = 28.3305 exactly
    const profitEntry = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.idempotencyKey, `trade-settle-profit:${tradeId}`));
    expect(profitEntry[0]?.amount).toBe("28.330500000000000000");
    expect(row?.status).toBe("WON");
  });

  it("is a safe no-op when called again after settlement", async () => {
    const user = await fundedUser();
    const tradeId = await placeAndForceOutcome({ userId: user.id, direction: "RISE", outcome: "WIN" });

    const first = await settleTrade(tradeId);
    const second = await settleTrade(tradeId);
    expect(second.status).toBe(first.status);
    expect(second.settlementPrice).toBe(first.settlementPrice);

    const availableId = await accountId(userAccount(user.id, CURRENCY, "AVAILABLE"));
    // Balance must be unchanged by the second call — no double payout.
    expect(await balanceOf(availableId)).toBe("1008.500000000000000000");
  });

  it("returns the row rather than throwing when a trade isn't due yet", async () => {
    const user = await fundedUser();
    const trade = await placeTrade({
      userId: user.id,
      instrumentId: INSTRUMENT_ID,
      currency: CURRENCY,
      direction: "RISE",
      durationSeconds: 300,
      stakeAmount: "10",
      idempotencyKey: crypto.randomUUID(),
    });

    const result = await settleTrade(trade.id);
    expect(result.status).toBe("OPEN");
  });

  it("under concurrent settlement attempts, settles exactly once", async () => {
    const user = await fundedUser();
    const tradeId = await placeAndForceOutcome({ userId: user.id, direction: "RISE", outcome: "WIN" });

    const results = await Promise.allSettled(Array.from({ length: 10 }, () => settleTrade(tradeId)));
    const settledStatuses = results.filter((r) => r.status === "fulfilled").map((r) => r.value.status);
    expect(settledStatuses.every((status) => status === "WON")).toBe(true);

    const profitEntries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.idempotencyKey, `trade-settle-profit:${tradeId}`));
    expect(profitEntries).toHaveLength(1);

    const availableId = await accountId(userAccount(user.id, CURRENCY, "AVAILABLE"));
    expect(await balanceOf(availableId)).toBe("1008.500000000000000000");
    expect(await reconciledBalance(availableId)).toBe(await balanceOf(availableId));
  });
});

describe("settleDueTradesForUser", () => {
  it("settles every due trade for that user and leaves others alone", async () => {
    const user = await fundedUser();
    const dueId = await placeAndForceOutcome({ userId: user.id, direction: "RISE", outcome: "WIN" });
    const notDueTrade = await placeTrade({
      userId: user.id,
      instrumentId: INSTRUMENT_ID,
      currency: CURRENCY,
      direction: "RISE",
      durationSeconds: 300,
      stakeAmount: "5",
      idempotencyKey: crypto.randomUUID(),
    });

    const settled = await settleDueTradesForUser(user.id);
    expect(settled.map((t) => t.id)).toContain(dueId);
    expect(settled.map((t) => t.id)).not.toContain(notDueTrade.id);

    const [stillOpen] = await db.select().from(trades).where(eq(trades.id, notDueTrade.id));
    expect(stillOpen?.status).toBe("OPEN");
  });
});

describe("voidTrade", () => {
  it("returns the locked stake to AVAILABLE and marks the trade REFUNDED", async () => {
    const user = await fundedUser();
    const admin = await createTestUser();
    const trade = await placeTrade({
      userId: user.id,
      instrumentId: INSTRUMENT_ID,
      currency: CURRENCY,
      direction: "RISE",
      durationSeconds: 300,
      stakeAmount: "25",
      idempotencyKey: crypto.randomUUID(),
    });

    const voided = await voidTrade({
      tradeId: trade.id,
      adminUserId: admin.id,
      reason: "system glitch",
      ip: null,
    });

    expect(voided.status).toBe("REFUNDED");
    const availableId = await accountId(userAccount(user.id, CURRENCY, "AVAILABLE"));
    expect(await balanceOf(availableId)).toBe("1000.000000000000000000");
  });

  it("refuses to void a trade that's already settled", async () => {
    const user = await fundedUser();
    const admin = await createTestUser();
    const tradeId = await placeAndForceOutcome({ userId: user.id, direction: "RISE", outcome: "WIN" });
    await settleTrade(tradeId);

    await expect(
      voidTrade({ tradeId, adminUserId: admin.id, reason: "too late", ip: null }),
    ).rejects.toThrow(TradeError);
  });

  it("racing voidTrade against settleTrade at the expiry boundary resolves to exactly one terminal status", async () => {
    const user = await fundedUser();
    const admin = await createTestUser();
    const tradeId = await placeAndForceOutcome({ userId: user.id, direction: "RISE", outcome: "WIN" });

    const results = await Promise.allSettled([
      settleTrade(tradeId),
      voidTrade({ tradeId, adminUserId: admin.id, reason: "race test", ip: null }),
    ]);

    const [row] = await db.select().from(trades).where(eq(trades.id, tradeId));
    expect(["WON", "REFUNDED"]).toContain(row?.status);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    const availableId = await accountId(userAccount(user.id, CURRENCY, "AVAILABLE"));
    expect(await reconciledBalance(availableId)).toBe(await balanceOf(availableId));
  });
});
