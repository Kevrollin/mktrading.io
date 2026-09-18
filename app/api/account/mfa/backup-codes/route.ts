import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/dal";
import { generateBackupCodes, isMfaEnabled } from "@/lib/auth/mfa";
import { verifyStepUp } from "@/lib/auth/step-up";
import { stepUpSchema } from "@/lib/validation/auth";

// Regenerating is itself a step-up action: it invalidates every existing
// backup code, so it needs the same re-check as disabling MFA.
export async function POST(request: Request) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!(await isMfaEnabled(user.id))) {
    return NextResponse.json({ error: "Enable MFA first." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = stepUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const verified = await verifyStepUp(user.id, parsed.data);
  if (!verified) {
    return NextResponse.json({ error: "Incorrect password or code." }, { status: 400 });
  }

  const backupCodes = await generateBackupCodes(user.id);
  return NextResponse.json({ success: true, backupCodes });
}
