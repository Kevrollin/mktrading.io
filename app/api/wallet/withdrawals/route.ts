import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/dal";
import { RATE_LIMITS } from "@/lib/auth/constants";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db/client";
import { currencies, withdrawals } from "@/lib/db/schema";
import { InsufficientFundsError } from "@/lib/ledger/post";
import { requestWithdrawal, WithdrawalError } from "@/lib/withdrawals/state-machine";
import { requestWithdrawalSchema } from "@/lib/validation/wallet";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.userId, user.id))
    .orderBy(desc(withdrawals.createdAt));

  return NextResponse.json({ withdrawals: rows });
}

export async function POST(request: Request) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const rateCheck = await checkRateLimit(
    `withdrawal-request:${user.id}`,
    RATE_LIMITS.withdrawalRequestPerUser,
  );
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: "Too many withdrawal requests. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestWithdrawalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { currency, amount, destination } = parsed.data;

  const [currencyRow] = await db.select().from(currencies).where(eq(currencies.code, currency));
  if (!currencyRow || !currencyRow.isActive) {
    return NextResponse.json({ error: "Unsupported currency." }, { status: 400 });
  }

  const decimalPlaces = amount.includes(".") ? amount.split(".")[1]!.length : 0;
  if (decimalPlaces > currencyRow.decimals) {
    return NextResponse.json(
      { error: `${currency} supports at most ${currencyRow.decimals} decimal places.` },
      { status: 400 },
    );
  }

  const idempotencyKey = request.headers.get("idempotency-key") ?? crypto.randomUUID();

  try {
    const withdrawal = await requestWithdrawal({
      userId: user.id,
      currency,
      amount,
      destination,
      idempotencyKey,
    });
    return NextResponse.json({ withdrawal }, { status: 201 });
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return NextResponse.json({ error: "Insufficient available balance." }, { status: 400 });
    }
    if (error instanceof WithdrawalError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
