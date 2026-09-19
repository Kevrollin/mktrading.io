import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { getWalletSummary } from "@/lib/ledger/balances";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const balances = await getWalletSummary(user.id);
  return NextResponse.json({ balances });
}
