import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { getCurrentUser } from "@/lib/auth/dal";
import { revokeAllSessions, verifyAndRefreshSession } from "@/lib/auth/session";
import { revokeAllTrustedDevices } from "@/lib/auth/trusted-device";

export async function POST(request: Request) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const currentSession = currentToken ? await verifyAndRefreshSession(currentToken) : null;

  // Keeps the acting session alive on purpose — the button that fires
  // this request is itself running inside that session, so killing it
  // too would just be a confusing logout rather than "log out everywhere
  // else."
  await revokeAllSessions(
    user.id,
    currentSession ? { exceptSessionId: currentSession.id } : undefined,
  );
  await revokeAllTrustedDevices(user.id);

  return NextResponse.json({ success: true });
}
