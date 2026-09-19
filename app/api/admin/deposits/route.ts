import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ForbiddenError, requireAdminApi } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { deposits } from "@/lib/db/schema";

export async function GET() {
  try {
    await requireAdminApi();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const rows = await db.select().from(deposits).orderBy(desc(deposits.placedAt)).limit(100);
  return NextResponse.json({ deposits: rows });
}
