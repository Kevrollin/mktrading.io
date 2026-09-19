import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { RATE_LIMITS } from "@/lib/auth/constants";
import { verifyMfaCode } from "@/lib/auth/mfa";
import { verifyPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/auth/rate-limit";

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

/** Every admin wallet action (approve/reject/mark-processing/mark-
 * completed/adjust) re-checks a fresh MFA code — code only, never the
 * password branch above, and rate-limited per admin. */
export async function verifyAdminStepUp(
  adminId: string,
  code: string,
): Promise<{ allowed: true } | { allowed: false; reason: "rate_limited" | "invalid_code" }> {
  const rateCheck = await checkRateLimit(`admin-step-up:${adminId}`, RATE_LIMITS.adminStepUpPerAdmin);
  if (!rateCheck.allowed) {
    return { allowed: false, reason: "rate_limited" };
  }

  const valid = await verifyMfaCode(adminId, code);
  if (!valid) {
    return { allowed: false, reason: "invalid_code" };
  }
  return { allowed: true };
}
