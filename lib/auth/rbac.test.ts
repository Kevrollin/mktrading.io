import { eq, sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { createTestUser } from "@/lib/db/test-utils";
import { roles, userRoles } from "@/lib/db/schema";
import type { RoleName } from "@/lib/db/schema";
import { getCurrentUserRoles, isAdminRole } from "@/lib/auth/rbac";

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE user_roles, users CASCADE`);
});

async function grantRole(userId: string, roleName: RoleName) {
  const [role] = await db.select().from(roles).where(eq(roles.name, roleName));
  if (!role) throw new Error(`Role ${roleName} not seeded.`);
  await db.insert(userRoles).values({ userId, roleId: role.id });
}

describe("rbac", () => {
  it("a plain USER has no admin roles", async () => {
    const user = await createTestUser();
    await grantRole(user.id, "USER");

    const roleNames = await getCurrentUserRoles(user.id);
    expect(isAdminRole(roleNames)).toBe(false);
  });

  it("an admin role is recognized as admin", async () => {
    const user = await createTestUser();
    await grantRole(user.id, "FINANCE_ADMIN");

    const roleNames = await getCurrentUserRoles(user.id);
    expect(isAdminRole(roleNames)).toBe(true);
  });

  it("a user with no roles at all is not admin", async () => {
    const user = await createTestUser();
    const roleNames = await getCurrentUserRoles(user.id);
    expect(roleNames).toEqual([]);
    expect(isAdminRole(roleNames)).toBe(false);
  });
});
