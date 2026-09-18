import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

/** Minimal user row for DB-backed tests that need a valid FK target. */
export async function createTestUser(overrides?: Partial<typeof users.$inferInsert>) {
  const suffix = crypto.randomUUID();
  const [user] = await db
    .insert(users)
    .values({
      email: `test-${suffix}@example.com`,
      phone: `+1555${suffix.replace(/-/g, "").slice(0, 7)}`,
      passwordHash: "not-a-real-hash",
      ...overrides,
    })
    .returning();
  if (!user) throw new Error("Failed to create test user.");
  return user;
}
