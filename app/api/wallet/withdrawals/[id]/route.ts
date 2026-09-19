import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db/client";
import { withdrawals } from "@/lib/db/schema";
import { cancelWithdrawal, WithdrawalError } from "@/lib/withdrawals/state-machine";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  const [withdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.id, id));
  if (!withdrawal || withdrawal.userId !== user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ withdrawal });
}

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
    const withdrawal = await cancelWithdrawal(id, user.id);
    return NextResponse.json({ withdrawal });
  } catch (error) {
    if (error instanceof WithdrawalError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
