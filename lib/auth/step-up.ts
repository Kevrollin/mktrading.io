import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { verifyMfaCode } from "@/lib/auth/mfa";
import { verifyPassword } from "@/lib/auth/password";

/** Re-authentication check for security-downgrade actions (disable MFA,
 * regenerate backup codes) — a bare session cookie already proves the
 * user is logged in, but not that they can act on a step-up decision
 * right now. */
export async function verifyStepUp(
  userId: string,
  input: { password?: string; code?: string },
): Promise<boolean> {
  if (input.password) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (user && (await verifyPassword(user.passwordHash, input.password))) {
      return true;
    }
  }
  if (input.code) {
    return verifyMfaCode(userId, input.code);
  }
  return false;
}
