import { NextResponse, type NextRequest } from "next/server";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { generateToken } from "@/lib/auth/tokens";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

/**
 * Next.js 16 renamed middleware.ts -> proxy.ts (exported function `proxy`,
 * runs on the Node.js runtime).
 *
 * Two responsibilities:
 * 1. A cheap cookie-presence check on /app/* and /admin/* — not a DB
 *    round-trip on every request. The authoritative, DB-verified checks
 *    (session validity, and for /admin/* the actual admin-role check)
 *    live in lib/auth/dal.ts and lib/auth/rbac.ts and run at the point of
 *    data access; a present-but-actually-expired/revoked cookie, or a
 *    valid session that just isn't an admin, still gets redirected
 *    correctly there. This layer just handles the common "no cookie at
 *    all" case.
 * 2. Bootstraps the double-submit CSRF cookie on first visit, on every
 *    path — Server Components can only read cookies, not set them, so
 *    this is the one place that can guarantee the cookie exists before
 *    any form is submitted.
 */
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (
    (pathname.startsWith("/app") || pathname.startsWith("/admin")) &&
    !request.cookies.has(SESSION_COOKIE_NAME)
  ) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const response = NextResponse.redirect(loginUrl);
    ensureCsrfCookie(request, response);
    return response;
  }

  const response = NextResponse.next();
  ensureCsrfCookie(request, response);
  return response;
}

function ensureCsrfCookie(request: NextRequest, response: NextResponse) {
  if (!request.cookies.has(CSRF_COOKIE_NAME)) {
    response.cookies.set(CSRF_COOKIE_NAME, generateToken(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }
}
