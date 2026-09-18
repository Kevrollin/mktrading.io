import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { revokeSession, verifyAndRefreshSession } from "@/lib/auth/session";

// POST only — never GET. A plain <a href="/api/auth/logout"> would be
// exploitable via SameSite=Lax cookies riding along on a cross-site
// top-level navigation even though they're blocked on cross-site POST.
export async function POST(request: Request) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const session = await verifyAndRefreshSession(token);
    if (session) {
      await revokeSession(session.id, session.userId);
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
