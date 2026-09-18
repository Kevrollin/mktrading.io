import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/dal";
import { revokeSession } from "@/lib/auth/session";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;
  // revokeSession scopes by userId itself — an id belonging to another
  // user just matches zero rows, not an error (no IDOR).
  await revokeSession(id, user.id);

  return NextResponse.json({ success: true });
}
