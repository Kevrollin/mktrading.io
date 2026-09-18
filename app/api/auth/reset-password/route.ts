import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { hashPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { revokeAllSessions } from "@/lib/auth/session";
import { revokeAllTrustedDevices } from "@/lib/auth/trusted-device";
import { getEmailProvider } from "@/lib/email/provider";
import { passwordResetConfirmSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = passwordResetConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);

  const passwordHash = await hashPassword(password);

  // Single atomic conditional UPDATE — zero rows affected means invalid,
  // expired, or already-used, and all three get the identical generic
  // response. The password update happens in the same transaction as the
  // claim, so a crash in between can't burn the token with no effect.
  const claimedUserId = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(passwordResetTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.consumedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: passwordResetTokens.userId });

    if (!claimed) return null;

    await tx.update(users).set({ passwordHash }).where(eq(users.id, claimed.userId));
    return claimed.userId;
  });

  if (!claimedUserId) {
    return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 400 });
  }

  // Unauthenticated reset: revoke everything and do NOT issue a new
  // session — auto-login here would be a silent MFA bypass via mailbox
  // compromise alone. The user logs in fresh, facing MFA like anyone else.
  await revokeAllSessions(claimedUserId);
  await revokeAllTrustedDevices(claimedUserId);

  const [user] = await db.select().from(users).where(eq(users.id, claimedUserId));
  if (user) {
    await getEmailProvider().send({
      userId: user.id,
      to: user.email,
      type: "password_changed",
      subject: "Your MKTrading password was changed",
      body: "Your password was just reset. If this wasn't you, contact support immediately — every other session and trusted device has been signed out as a precaution.",
    });
  }

  return NextResponse.json({ success: true });
}
