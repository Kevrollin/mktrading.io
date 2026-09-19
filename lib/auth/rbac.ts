import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db/client";
import { roles, userRoles } from "@/lib/db/schema";
import type { RoleName } from "@/lib/db/schema";

const ADMIN_ROLES: RoleName[] = [
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "COMPLIANCE_ADMIN",
  "OPERATIONS_ADMIN",
  "RISK_ADMIN",
];

/** Cached per-request, same pattern as getCurrentUser. */
export const getCurrentUserRoles = cache(async (userId: string): Promise<RoleName[]> => {
  const rows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));
  return rows.map((row) => row.name as RoleName);
});

export function isAdminRole(roleNames: RoleName[]): boolean {
  return roleNames.some((name) => ADMIN_ROLES.includes(name));
}

/** For Server Components/pages only — redirects rather than returning
 * null/throwing, mirroring requireUser(). Route Handlers should use
 * requireAdminApi() instead. */
export async function requireAdmin(): Promise<{ user: CurrentUser; roles: RoleName[] }> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const roleNames = await getCurrentUserRoles(user.id);
  if (!isAdminRole(roleNames)) {
    redirect("/app");
  }
  return { user, roles: roleNames };
}

export class ForbiddenError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** For Route Handlers — throws instead of redirecting, so callers can
 * catch it and return the right JSON status (401 unauthenticated vs. 403
 * authenticated-but-not-admin). */
export async function requireAdminApi(): Promise<{ user: CurrentUser; roles: RoleName[] }> {
  const user = await getCurrentUser();
  if (!user) {
    throw new ForbiddenError("Not authenticated.", 401);
  }
  const roleNames = await getCurrentUserRoles(user.id);
  if (!isAdminRole(roleNames)) {
    throw new ForbiddenError("Not authorized.", 403);
  }
  return { user, roles: roleNames };
}

/** Page-level gate for SUPER_ADMIN-only sections (e.g. platform wallet
 * configuration) — stricter than requireAdmin(), which accepts any of
 * the five admin roles. */
export async function requireSuperAdmin(): Promise<{ user: CurrentUser; roles: RoleName[] }> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const roleNames = await getCurrentUserRoles(user.id);
  if (!roleNames.includes("SUPER_ADMIN")) {
    redirect("/admin/withdrawals");
  }
  return { user, roles: roleNames };
}

/** Route Handler equivalent of requireSuperAdmin(). */
export async function requireSuperAdminApi(): Promise<{ user: CurrentUser; roles: RoleName[] }> {
  const user = await getCurrentUser();
  if (!user) {
    throw new ForbiddenError("Not authenticated.", 401);
  }
  const roleNames = await getCurrentUserRoles(user.id);
  if (!roleNames.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("Not authorized.", 403);
  }
  return { user, roles: roleNames };
}
