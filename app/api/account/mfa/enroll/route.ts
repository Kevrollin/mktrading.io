import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/dal";
import { beginMfaEnrollment } from "@/lib/auth/mfa";

export async function POST(request: Request) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const enrollment = await beginMfaEnrollment(user.id, user.email);
  return NextResponse.json({ secret: enrollment.secret, qrDataUrl: enrollment.qrDataUrl });
}
