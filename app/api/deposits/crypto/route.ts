import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { RATE_LIMITS } from "@/lib/auth/constants";
import { getCurrentUser } from "@/lib/auth/dal";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db/client";
import { currencies } from "@/lib/db/schema";
import { DepositError, requestCryptoDeposit } from "@/lib/deposits/state-machine";
import { requestCryptoDepositSchema } from "@/lib/validation/deposits";

export async function POST(request: Request) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const rateCheck = await checkRateLimit(`deposit-request:${user.id}`, RATE_LIMITS.depositRequestPerUser);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: "Too many deposit requests. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestCryptoDepositSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { currency, requestedAmount } = parsed.data;

  const [currencyRow] = await db.select().from(currencies).where(eq(currencies.code, currency));
  if (!currencyRow || !currencyRow.isActive || currencyRow.kind !== "CRYPTO") {
    return NextResponse.json({ error: "Unsupported currency." }, { status: 400 });
  }

  const decimalPlaces = requestedAmount.includes(".") ? requestedAmount.split(".")[1]!.length : 0;
  if (decimalPlaces > currencyRow.decimals) {
    return NextResponse.json(
      { error: `${currency} supports at most ${currencyRow.decimals} decimal places.` },
      { status: 400 },
    );
  }

  const idempotencyKey = request.headers.get("idempotency-key") ?? crypto.randomUUID();

  try {
    const deposit = await requestCryptoDeposit({
      userId: user.id,
      currency,
      requestedAmount,
      idempotencyKey,
    });
    return NextResponse.json({ deposit }, { status: 201 });
  } catch (error) {
    if (error instanceof DepositError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
