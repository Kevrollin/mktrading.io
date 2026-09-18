import { cookies } from "next/headers";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/auth/constants";

/** Primary CSRF defense: double-submit cookie. The cookie itself is
 * bootstrapped by proxy.ts on first visit (non-httpOnly, so client JS can
 * read and echo it as a header); a cross-site page can trigger the cookie
 * to ride along automatically but can't read its value to forge a
 * matching header. */
export async function verifyCsrf(request: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  const headerValue = request.headers.get(CSRF_HEADER_NAME);
  if (!cookieValue || !headerValue) return false;
  return cookieValue === headerValue;
}

/** Secondary defense layer, checked alongside verifyCsrf, not instead of
 * it. */
export function isSameOriginRequest(request: Request): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite) {
    return secFetchSite === "same-origin" || secFetchSite === "none";
  }

  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/** Convenience for route handlers: both layers at once. */
export async function assertCsrfSafe(request: Request): Promise<boolean> {
  return isSameOriginRequest(request) && (await verifyCsrf(request));
}
