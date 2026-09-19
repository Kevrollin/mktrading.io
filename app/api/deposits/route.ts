import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db/client";
import { deposits } from "@/lib/db/schema";
import { settleDueMobileMoneyDepositsForUser } from "@/lib/deposits/state-machine";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  await settleDueMobileMoneyDepositsForUser(user.id);

  const rows = await db
    .select()
    .from(deposits)
    .where(eq(deposits.userId, user.id))
    .orderBy(desc(deposits.placedAt))
    .limit(50);

  return NextResponse.json({ deposits: rows });
}
