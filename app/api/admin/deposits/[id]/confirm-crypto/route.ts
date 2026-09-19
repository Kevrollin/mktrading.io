import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { ForbiddenError, requireAdminApi } from "@/lib/auth/rbac";
import { getClientIp } from "@/lib/auth/request-context";
import { verifyAdminStepUp } from "@/lib/auth/step-up";
import { confirmCryptoDeposit, DepositError } from "@/lib/deposits/state-machine";
import { confirmCryptoDepositSchema } from "@/lib/validation/deposits";

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
  const parsed = confirmCryptoDepositSchema.safeParse(body);
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
    const deposit = await confirmCryptoDeposit({
      depositId: id,
      adminUserId: admin.id,
      txHash: parsed.data.txHash,
      confirmedAmount: parsed.data.confirmedAmount,
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
