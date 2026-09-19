import { NextResponse } from "next/server";
import { ForbiddenError, requireSuperAdminApi } from "@/lib/auth/rbac";
import { listPlatformWallets } from "@/lib/platform-wallets/service";

export async function GET() {
  try {
    await requireSuperAdminApi();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const wallets = await listPlatformWallets();
  return NextResponse.json({ wallets });
}
