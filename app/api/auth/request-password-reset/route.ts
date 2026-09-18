import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { PASSWORD_RESET_TOKEN_TTL_MS, RATE_LIMITS } from "@/lib/auth/constants";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getClientIp } from "@/lib/auth/request-context";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { SITE_URL } from "@/lib/constants";
import { getEmailProvider } from "@/lib/email/provider";
import { passwordResetRequestSchema } from "@/lib/validation/auth";

function genericSuccess() {
  return NextResponse.json({
    message: "If an account matches, a password reset link has been sent.",
  });
}

export async function POST(request: Request) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = passwordResetRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { identifier, website } = parsed.data;

  if (website) {
    return genericSuccess();
  }

  const ip = getClientIp(request);
  if (ip) {
    const ipCheck = await checkRateLimit(
      `pwreset:ip:${ip}`,
      RATE_LIMITS.passwordResetRequestPerIp,
    );
    if (!ipCheck.allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }
  }
  const identifierCheck = await checkRateLimit(
    `pwreset:id:${identifier}`,
    RATE_LIMITS.passwordResetRequestPerIdentifier,
  );
  if (!identifierCheck.allowed) {
    // Anti-enumeration: identical generic response even when rate limited.
    return genericSuccess();
  }

  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, identifier.toLowerCase()), eq(users.phone, identifier)));

  // Anti-enumeration: identical response whether or not the account
  // exists — only the branch below differs, and it has no observable
  // synchronous effect for the caller.
  if (user) {
    const token = generateToken();
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
    });

    const resetUrl = new URL("/reset-password", SITE_URL);
    resetUrl.searchParams.set("token", token);

    await getEmailProvider().send({
      userId: user.id,
      to: user.email,
      type: "security_alert",
      subject: "Reset your MKTrading password",
      body: `A password reset was requested for your account. If this was you, use this link to choose a new password: ${resetUrl.toString()} This link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
      link: resetUrl.toString(),
    });
  }

  return genericSuccess();
}
