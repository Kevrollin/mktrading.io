import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { ForbiddenError, requireAdminApi } from "@/lib/auth/rbac";
import { getClientIp } from "@/lib/auth/request-context";
import { verifyAdminStepUp } from "@/lib/auth/step-up";
import { DepositError, rejectDeposit } from "@/lib/deposits/state-machine";
import { rejectDepositSchema } from "@/lib/validation/deposits";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const parsed = rejectDepositSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const stepUp = await verifyAdminStepUp(admin.id, parsed.data.code);
  if (!stepUp.allowed) {
    const status = stepUp.reason === "rate_limited" ? 429 : 400;
    return NextResponse.json(
      { error: stepUp.reason === "rate_limited" ? "Too many attempts. Try again later." : "Incorrect code." },
      { status },
    );
  }

  const { id } = await params;
  try {
    const deposit = await rejectDeposit({
      depositId: id,
      adminUserId: admin.id,
      reason: parsed.data.reason,
      ip: getClientIp(request),
    });
    return NextResponse.json({ deposit });
  } catch (error) {
    if (error instanceof DepositError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
