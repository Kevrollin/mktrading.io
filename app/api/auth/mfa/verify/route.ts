import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { loginEvents, users } from "@/lib/db/schema";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import {
  MFA_PENDING_COOKIE_NAME,
  RATE_LIMITS,
  SESSION_COOKIE_NAME,
  TRUSTED_DEVICE_COOKIE_NAME,
  TRUSTED_DEVICE_TTL_MS,
} from "@/lib/auth/constants";
import { consumePendingLogin, resolvePendingLogin } from "@/lib/auth/mfa-pending";
import { verifyAndConsumeBackupCode, verifyMfaCode } from "@/lib/auth/mfa";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getClientIp, getUserAgent } from "@/lib/auth/request-context";
import { issueSession } from "@/lib/auth/session";
import { issueTrustedDevice } from "@/lib/auth/trusted-device";
import { mfaVerifySchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const cookieStore = await cookies();
  const pendingToken = cookieStore.get(MFA_PENDING_COOKIE_NAME)?.value;
  if (!pendingToken) {
    return NextResponse.json({ error: "Your login session has expired. Log in again." }, { status: 401 });
  }

  const pending = await resolvePendingLogin(pendingToken);
  if (!pending) {
    const response = NextResponse.json(
      { error: "Your login session has expired. Log in again." },
      { status: 401 },
    );
    response.cookies.delete(MFA_PENDING_COOKIE_NAME);
    return response;
  }

  const rateCheck = await checkRateLimit(`mfa-verify:${pending.id}`, RATE_LIMITS.mfaVerifyPerPendingLogin);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = mfaVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { code, rememberDevice } = parsed.data;

  const ip = getClientIp(request);
  const userAgent = getUserAgent(request);

  const validTotp = await verifyMfaCode(pending.userId, code);
  const validBackupCode = validTotp ? false : await verifyAndConsumeBackupCode(pending.userId, code);

  if (!validTotp && !validBackupCode) {
    await db.insert(loginEvents).values({
      userId: pending.userId,
      identifier: pending.userId,
      success: false,
      failureReason: "mfa_failed",
      ip,
      userAgent,
    });
    return NextResponse.json({ error: "Incorrect code." }, { status: 401 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, pending.userId));
  if (!user || user.status !== "active") {
    return NextResponse.json({ error: "This account is restricted. Contact support." }, { status: 403 });
  }

  await consumePendingLogin(pending.id);

  const session = await issueSession({ userId: user.id, userAgent, ip });
  await db.insert(loginEvents).values({
    userId: user.id,
    identifier: user.email,
    success: true,
    ip,
    userAgent,
  });

  const response = NextResponse.json({ success: true });
  response.cookies.delete(MFA_PENDING_COOKIE_NAME);
  response.cookies.set(SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });

  if (rememberDevice) {
    const device = await issueTrustedDevice({ userId: user.id, userAgent, ip });
    response.cookies.set(TRUSTED_DEVICE_COOKIE_NAME, device.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: TRUSTED_DEVICE_TTL_MS / 1000,
    });
  }

  return response;
}
