import { desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ForbiddenError, requireAdminApi } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { withdrawals } from "@/lib/db/schema";

const QUEUE_STATUSES = ["PENDING_APPROVAL", "EXECUTION_AUTHORIZED", "PROCESSING"] as const;

export async function GET(request: Request) {
  try {
    await requireAdminApi();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const showAll = new URL(request.url).searchParams.get("all") === "true";
  const rows = await db
    .select()
    .from(withdrawals)
    .where(showAll ? undefined : inArray(withdrawals.status, QUEUE_STATUSES))
    .orderBy(desc(withdrawals.createdAt));

  return NextResponse.json({ withdrawals: rows });
}
