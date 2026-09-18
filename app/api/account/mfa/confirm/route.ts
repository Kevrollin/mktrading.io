import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/dal";
import { confirmMfaEnrollment, generateBackupCodes } from "@/lib/auth/mfa";
import { mfaCodeSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = mfaCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const confirmed = await confirmMfaEnrollment(user.id, parsed.data.code);
  if (!confirmed) {
    return NextResponse.json({ error: "Incorrect code." }, { status: 400 });
  }

  // Shown once, here — never retrievable again after this response.
  const backupCodes = await generateBackupCodes(user.id);

  return NextResponse.json({ success: true, backupCodes });
}
