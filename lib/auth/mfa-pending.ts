import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { mfaPendingLogins } from "@/lib/db/schema";
import { MFA_PENDING_COOKIE_TTL_MS } from "@/lib/auth/constants";
import { generateToken, hashToken } from "@/lib/auth/tokens";

export async function issuePendingLogin(userId: string): Promise<{ token: string }> {
  const token = generateToken();
  await db.insert(mfaPendingLogins).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + MFA_PENDING_COOKIE_TTL_MS),
  });
  return { token };
}

export interface ResolvedPendingLogin {
  id: string;
  userId: string;
}

export async function resolvePendingLogin(rawToken: string): Promise<ResolvedPendingLogin | null> {
  const tokenHash = hashToken(rawToken);
  const [pending] = await db
    .select()
    .from(mfaPendingLogins)
    .where(eq(mfaPendingLogins.tokenHash, tokenHash));

  if (!pending) return null;
  if (pending.expiresAt <= new Date()) return null;
  return { id: pending.id, userId: pending.userId };
}

/** Only call on a successful MFA verification — a failed attempt must
 * leave the pending login valid so the user can retry within the rate
 * limit. */
export async function consumePendingLogin(id: string): Promise<void> {
  await db.delete(mfaPendingLogins).where(eq(mfaPendingLogins.id, id));
}
