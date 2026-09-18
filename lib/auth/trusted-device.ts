import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { trustedDevices } from "@/lib/db/schema";
import { TRUSTED_DEVICE_TTL_MS } from "@/lib/auth/constants";
import { generateToken, hashToken } from "@/lib/auth/tokens";

export async function issueTrustedDevice(params: {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_TTL_MS);

  await db.insert(trustedDevices).values({
    userId: params.userId,
    tokenHash: hashToken(token),
    expiresAt,
    userAgent: params.userAgent ?? null,
    ip: params.ip ?? null,
  });

  return { token, expiresAt };
}

/** Must check userId matches, not just that the token hash resolves to
 * *some* row — a trusted-device token only skips MFA for the account it
 * was issued to. */
export async function isTrustedDevice(userId: string, rawToken: string): Promise<boolean> {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [device] = await db
    .select()
    .from(trustedDevices)
    .where(
      and(
        eq(trustedDevices.tokenHash, tokenHash),
        eq(trustedDevices.userId, userId),
        isNull(trustedDevices.revokedAt),
      ),
    );

  return Boolean(device && device.expiresAt > now);
}

/** Must be called alongside revokeAllSessions on password/MFA change and
 * "log out everywhere" — otherwise a standing MFA-skip survives on an
 * attacker's browser even after the user thinks they've locked them out. */
export async function revokeAllTrustedDevices(userId: string) {
  await db
    .update(trustedDevices)
    .set({ revokedAt: new Date() })
    .where(and(eq(trustedDevices.userId, userId), isNull(trustedDevices.revokedAt)));
}
