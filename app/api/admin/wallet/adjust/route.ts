import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { ForbiddenError, requireAdminApi } from "@/lib/auth/rbac";
import { getClientIp } from "@/lib/auth/request-context";
import { verifyAdminStepUp } from "@/lib/auth/step-up";
import { db } from "@/lib/db/client";
import { auditLogs, currencies } from "@/lib/db/schema";
import { InsufficientFundsError } from "@/lib/ledger/post";
import { postAdminAdjustment } from "@/lib/ledger/admin-adjustment";
import { adminAdjustmentSchema } from "@/lib/validation/wallet";

export async function POST(request: Request) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  let admin;
  try {
    ({ user: admin } = await requireAdminApi());
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = adminAdjustmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { targetUserId, currency, amount, direction, reason, code } = parsed.data;

  const stepUp = await verifyAdminStepUp(admin.id, code);
  if (!stepUp.allowed) {
    const status = stepUp.reason === "rate_limited" ? 429 : 400;
    return NextResponse.json(
      { error: stepUp.reason === "rate_limited" ? "Too many attempts. Try again later." : "Incorrect code." },
      { status },
    );
  }

  const [currencyRow] = await db.select().from(currencies).where(eq(currencies.code, currency));
  if (!currencyRow || !currencyRow.isActive) {
    return NextResponse.json({ error: "Unsupported currency." }, { status: 400 });
  }

  try {
    const result = await postAdminAdjustment({
      adminUserId: admin.id,
      targetUserId,
      currency,
      amount,
      direction,
      reason,
      idempotencyKey: crypto.randomUUID(),
    });

    await db.insert(auditLogs).values({
      actorUserId: admin.id,
      action: "wallet.admin_adjustment",
      targetType: "user",
      targetId: targetUserId,
      after: { currency, amount, direction, reason },
      ip: getClientIp(request),
      correlationId: crypto.randomUUID(),
    });

    return NextResponse.json({ entryId: result.entryId }, { status: 201 });
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return NextResponse.json({ error: "Insufficient balance to debit." }, { status: 400 });
    }
    throw error;
  }
}
