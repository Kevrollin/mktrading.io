import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifyAndRefreshSession } from "@/lib/auth/session";

export interface CurrentUser {
  id: string;
  email: string;
  status: string;
}

/**
 * The one place Server Components / Route Handlers get authenticated-user
 * truth from. `proxy.ts` only does a cheap cookie-presence check to
 * redirect the obvious unauthenticated case early; this is the actual
 * DB-verified source of truth. Cached per-request (React `cache`) so
 * calling it from multiple components in one render doesn't re-verify the
 * session repeatedly.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifyAndRefreshSession(token);
  if (!session) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  if (!user || user.status !== "active") return null;

  return { id: user.id, email: user.email, status: user.status };
});

/** For Server Components/pages only — redirects to /login rather than
 * returning null. Route Handlers should call getCurrentUser() directly
 * and return a 401 JSON response themselves; redirecting a JSON API isn't
 * the right behavior there. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
