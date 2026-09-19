import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { listUserTransactions } from "@/lib/ledger/transactions";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const currency = new URL(request.url).searchParams.get("currency") ?? undefined;
  const transactions = await listUserTransactions(user.id, { currency });
  return NextResponse.json({ transactions });
}
