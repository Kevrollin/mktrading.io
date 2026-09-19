import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { RATE_LIMITS } from "@/lib/auth/constants";
import { getCurrentUser } from "@/lib/auth/dal";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db/client";
import { currencies } from "@/lib/db/schema";
import { DepositError, requestMobileMoneyDeposit } from "@/lib/deposits/state-machine";
import { requestMobileMoneyDepositSchema } from "@/lib/validation/deposits";

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
  const parsed = requestMobileMoneyDepositSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { requestedAmount, phone } = parsed.data;

  const [kes] = await db.select().from(currencies).where(eq(currencies.code, "KES"));
  const decimalPlaces = requestedAmount.includes(".") ? requestedAmount.split(".")[1]!.length : 0;
  if (kes && decimalPlaces > kes.decimals) {
    return NextResponse.json(
      { error: `KES supports at most ${kes.decimals} decimal places.` },
      { status: 400 },
    );
  }

  const idempotencyKey = request.headers.get("idempotency-key") ?? crypto.randomUUID();

  try {
    const deposit = await requestMobileMoneyDeposit({
      userId: user.id,
      requestedAmount,
      phone,
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
