import { eq, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { loginEvents, users, type LoginFailureReason } from "@/lib/db/schema";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import {
  MFA_PENDING_COOKIE_NAME,
  MFA_PENDING_COOKIE_TTL_MS,
  RATE_LIMITS,
  SESSION_COOKIE_NAME,
  TRUSTED_DEVICE_COOKIE_NAME,
} from "@/lib/auth/constants";
import { issuePendingLogin } from "@/lib/auth/mfa-pending";
import { isMfaEnabled } from "@/lib/auth/mfa";
import { verifyPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getClientIp, getUserAgent } from "@/lib/auth/request-context";
import { issueSession } from "@/lib/auth/session";
import { isTrustedDevice } from "@/lib/auth/trusted-device";
import { loginSchema } from "@/lib/validation/auth";

const INVALID_CREDENTIALS = { error: "Invalid email/phone or password." };

async function recordLoginEvent(params: {
  userId: string | null;
  identifier: string;
  success: boolean;
  failureReason?: LoginFailureReason;
  ip: string | null;
  userAgent: string | null;
}) {
  await db.insert(loginEvents).values({
    userId: params.userId,
    identifier: params.identifier,
    success: params.success,
    failureReason: params.failureReason,
    ip: params.ip,
    userAgent: params.userAgent,
  });
}

export async function POST(request: Request) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { identifier, password, website } = parsed.data;

  if (website) {
    return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
  }

  const ip = getClientIp(request);
  const userAgent = getUserAgent(request);

  // The identifier-keyed bucket is the real backstop (can't be bypassed
  // by IP/header games); the IP bucket is a secondary layer on top.
  if (ip) {
    const ipCheck = await checkRateLimit(`login:ip:${ip}`, RATE_LIMITS.loginPerIp);
    if (!ipCheck.allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }
  }
  const shortWindowCheck = await checkRateLimit(
    `login:id:${identifier}`,
    RATE_LIMITS.loginPerIdentifier,
  );
  const longWindowCheck = await checkRateLimit(
    `login:id-hr:${identifier}`,
    RATE_LIMITS.loginPerIdentifierHourly,
  );
  if (!shortWindowCheck.allowed || !longWindowCheck.allowed) {
    await recordLoginEvent({
      userId: null,
      identifier,
      success: false,
      failureReason: "rate_limited",
      ip,
      userAgent,
    });
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, identifier.toLowerCase()), eq(users.phone, identifier)));

  if (!user) {
    await recordLoginEvent({
      userId: null,
      identifier,
      success: false,
      failureReason: "no_such_account",
      ip,
      userAgent,
    });
    return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
  }

  const passwordOk = await verifyPassword(user.passwordHash, password);
  if (!passwordOk) {
    await recordLoginEvent({
      userId: user.id,
      identifier,
      success: false,
      failureReason: "bad_password",
      ip,
      userAgent,
    });
    return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
  }

  if (user.status !== "active") {
    await recordLoginEvent({
      userId: user.id,
      identifier,
      success: false,
      failureReason: "account_restricted",
      ip,
      userAgent,
    });
    return NextResponse.json({ error: "This account is restricted. Contact support." }, { status: 403 });
  }

  const mfaEnabled = await isMfaEnabled(user.id);
  const cookieStore = await cookies();
  const deviceToken = cookieStore.get(TRUSTED_DEVICE_COOKIE_NAME)?.value;
  const deviceTrusted = mfaEnabled && deviceToken ? await isTrustedDevice(user.id, deviceToken) : false;

  if (mfaEnabled && !deviceTrusted) {
    const pending = await issuePendingLogin(user.id);
    const response = NextResponse.json({ mfaRequired: true });
    response.cookies.set(MFA_PENDING_COOKIE_NAME, pending.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MFA_PENDING_COOKIE_TTL_MS / 1000,
    });
    return response;
  }

  const session = await issueSession({ userId: user.id, userAgent, ip });
  await recordLoginEvent({ userId: user.id, identifier, success: true, ip, userAgent });

  const response = NextResponse.json({ mfaRequired: false });
  response.cookies.set(SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
  return response;
}
