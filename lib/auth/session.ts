import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { SESSION_ABSOLUTE_LIFETIME_MS, SESSION_IDLE_TIMEOUT_MS } from "@/lib/auth/constants";
import { generateToken, hashToken } from "@/lib/auth/tokens";

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

export async function issueSession(params: {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<IssuedSession> {
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_IDLE_TIMEOUT_MS);
  const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_LIFETIME_MS);

  await db.insert(sessions).values({
    userId: params.userId,
    tokenHash: hashToken(token),
    expiresAt,
    absoluteExpiresAt,
    userAgent: params.userAgent ?? null,
    ip: params.ip ?? null,
  });

  return { token, expiresAt };
}

export interface ResolvedSession {
  id: string;
  userId: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
}

/** Verifies a raw session token and, if valid, slides its expiry forward
 * (never past absoluteExpiresAt). Returns null for missing/expired/revoked
 * sessions — callers should treat that uniformly as "not logged in". */
export async function verifyAndRefreshSession(rawToken: string): Promise<ResolvedSession | null> {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));

  if (!session) return null;
  if (session.expiresAt <= now) return null;
  if (session.absoluteExpiresAt <= now) return null;

  const nextExpiresAt = new Date(
    Math.min(now.getTime() + SESSION_IDLE_TIMEOUT_MS, session.absoluteExpiresAt.getTime()),
  );

  await db
    .update(sessions)
    .set({ lastActiveAt: now, expiresAt: nextExpiresAt })
    .where(eq(sessions.id, session.id));

  return {
    id: session.id,
    userId: session.userId,
    expiresAt: nextExpiresAt,
    absoluteExpiresAt: session.absoluteExpiresAt,
  };
}

/** Issues a fresh session and revokes the old one. Used on login and on
 * privilege-sensitive changes (password/MFA change) so a long-lived
 * session token isn't carried across a security boundary. */
export async function rotateSession(
  oldSessionId: string,
  params: { userId: string; userAgent?: string | null; ip?: string | null },
): Promise<IssuedSession> {
  const issued = await issueSession(params);
  await revokeSession(oldSessionId, params.userId);
  return issued;
}

export async function revokeSession(sessionId: string, userId: string) {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
}

/** Revokes every session for a user. `exceptSessionId` lets a "change
 * password" flow keep the acting session alive while killing every other
 * one — omit it for reset-password / "log out everywhere", which revoke
 * all of them unconditionally. */
export async function revokeAllSessions(userId: string, options?: { exceptSessionId?: string }) {
  const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];
  if (options?.exceptSessionId) {
    conditions.push(ne(sessions.id, options.exceptSessionId));
  }
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(...conditions));
}

export async function listActiveSessions(userId: string) {
  const now = new Date();
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  return rows.filter((row) => row.expiresAt > now && row.absoluteExpiresAt > now);
}
