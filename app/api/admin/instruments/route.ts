import { NextResponse } from "next/server";
import { ForbiddenError, requireSuperAdminApi } from "@/lib/auth/rbac";
import { listInstruments } from "@/lib/trading/instruments-service";

export async function GET() {
  try {
    await requireSuperAdminApi();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const instruments = await listInstruments(false);
  return NextResponse.json({ instruments });
}
