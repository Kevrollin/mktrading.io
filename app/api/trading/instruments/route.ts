import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { listInstruments } from "@/lib/trading/instruments-service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const instruments = await listInstruments(true);
  return NextResponse.json({ instruments });
}
