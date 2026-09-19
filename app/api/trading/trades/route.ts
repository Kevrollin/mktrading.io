import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/dal";
import { RATE_LIMITS } from "@/lib/auth/constants";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db/client";
import { currencies, trades } from "@/lib/db/schema";
import { InsufficientFundsError } from "@/lib/ledger/post";
import { placeTrade, settleDueTradesForUser, TradeError } from "@/lib/trading/state-machine";
import { placeTradeSchema } from "@/lib/validation/trading";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  await settleDueTradesForUser(user.id);

  const rows = await db
    .select()
    .from(trades)
    .where(eq(trades.userId, user.id))
    .orderBy(desc(trades.placedAt))
    .limit(50);

  return NextResponse.json({ trades: rows });
}

export async function POST(request: Request) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const rateCheck = await checkRateLimit(`trade-placement:${user.id}`, RATE_LIMITS.tradePlacementPerUser);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: "Too many trades placed. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = placeTradeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { instrumentId, currency, direction, durationSeconds, stakeAmount } = parsed.data;

  const [currencyRow] = await db.select().from(currencies).where(eq(currencies.code, currency));
  if (!currencyRow || !currencyRow.isActive) {
    return NextResponse.json({ error: "Unsupported currency." }, { status: 400 });
  }

  const decimalPlaces = stakeAmount.includes(".") ? stakeAmount.split(".")[1]!.length : 0;
  if (decimalPlaces > currencyRow.decimals) {
    return NextResponse.json(
      { error: `${currency} supports at most ${currencyRow.decimals} decimal places.` },
      { status: 400 },
    );
  }

  const idempotencyKey = request.headers.get("idempotency-key") ?? crypto.randomUUID();

  try {
    const trade = await placeTrade({
      userId: user.id,
      instrumentId,
      currency,
      direction,
      durationSeconds,
      stakeAmount,
      idempotencyKey,
    });
    return NextResponse.json({ trade }, { status: 201 });
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return NextResponse.json({ error: "Insufficient available balance." }, { status: 400 });
    }
    if (error instanceof TradeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
