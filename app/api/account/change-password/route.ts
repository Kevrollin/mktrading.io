import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { profiles, users } from "@/lib/db/schema";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { getCurrentUser } from "@/lib/auth/dal";
import { containsPersonalInfo, hashPassword, verifyPassword } from "@/lib/auth/password";
import { getClientIp, getUserAgent } from "@/lib/auth/request-context";
import { revokeAllSessions, rotateSession, verifyAndRefreshSession } from "@/lib/auth/session";
import { revokeAllTrustedDevices } from "@/lib/auth/trusted-device";
import { getEmailProvider } from "@/lib/email/provider";
import { changePasswordSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input.", issues: parsed.error.issues }, { status: 400 });
  }
  const { currentPassword, newPassword } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.id, currentUser.id));
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const currentOk = await verifyPassword(user.passwordHash, currentPassword);
  if (!currentOk) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id));
  if (containsPersonalInfo(newPassword, { email: user.email, fullName: profile?.fullName })) {
    return NextResponse.json(
      { error: "Password must not contain your name or email." },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const currentSession = currentToken ? await verifyAndRefreshSession(currentToken) : null;

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  await revokeAllTrustedDevices(user.id);

  // Authenticated change: revoke every OTHER session first, then rotate
  // the acting one — never leave the caller logged out by their own
  // request, but every other session/device dies.
  let rotated: { token: string; expiresAt: Date } | null = null;
  if (currentSession) {
    await revokeAllSessions(user.id, { exceptSessionId: currentSession.id });
    rotated = await rotateSession(currentSession.id, {
      userId: user.id,
      userAgent: getUserAgent(request),
      ip: getClientIp(request),
    });
  } else {
    await revokeAllSessions(user.id);
  }

  await getEmailProvider().send({
    userId: user.id,
    to: user.email,
    type: "password_changed",
    subject: "Your MKTrading password was changed",
    body: "Your password was just changed. Every other session and trusted device has been signed out as a precaution.",
  });

  const response = NextResponse.json({ success: true });
  if (rotated) {
    response.cookies.set(SESSION_COOKIE_NAME, rotated.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: rotated.expiresAt,
    });
  }
  return response;
}
