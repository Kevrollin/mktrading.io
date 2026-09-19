import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { ForbiddenError, requireAdminApi } from "@/lib/auth/rbac";
import { getClientIp } from "@/lib/auth/request-context";
import { verifyAdminStepUp } from "@/lib/auth/step-up";
import { markProcessing, WithdrawalError } from "@/lib/withdrawals/state-machine";
import { stepUpCodeSchema } from "@/lib/validation/wallet";

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
  const parsed = stepUpCodeSchema.safeParse(body);
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
    const withdrawal = await markProcessing(id, admin.id, getClientIp(request));
    return NextResponse.json({ withdrawal });
  } catch (error) {
    if (error instanceof WithdrawalError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
