import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ForbiddenError, requireAdminApi } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { withdrawalApprovals, withdrawals } from "@/lib/db/schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const { id } = await params;
  const [withdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.id, id));
  if (!withdrawal) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const approvals = await db
    .select()
    .from(withdrawalApprovals)
    .where(eq(withdrawalApprovals.withdrawalId, id));

  return NextResponse.json({ withdrawal, approvals });
}
