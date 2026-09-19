import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/dal";
import { cancelDeposit, DepositError } from "@/lib/deposits/state-machine";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const deposit = await cancelDeposit(id, user.id);
    return NextResponse.json({ deposit });
  } catch (error) {
    if (error instanceof DepositError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
