import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/auth/constants";

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

/** Wraps fetch for same-origin JSON API calls, attaching the double-
 * submit CSRF header the proxy already set as a cookie. Use this instead
 * of a bare fetch() for every mutating request to /api/*. */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const csrfToken = readCookie(CSRF_COOKIE_NAME);
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }
  return fetch(url, { ...options, headers, credentials: "same-origin" });
}
