import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { emailVerificationTokens, profiles, roles, userRoles, users } from "@/lib/db/schema";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { EMAIL_VERIFICATION_TOKEN_TTL_MS, RATE_LIMITS } from "@/lib/auth/constants";
import { hashPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getClientIp } from "@/lib/auth/request-context";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { getCaptchaProvider } from "@/lib/captcha/provider";
import { isOldEnough } from "@/lib/compliance/age";
import { isCountryEligible } from "@/lib/compliance/eligible-countries";
import { SITE_URL } from "@/lib/constants";
import { getEmailProvider } from "@/lib/email/provider";
import { registerSchema } from "@/lib/validation/auth";

function genericSuccess() {
  return NextResponse.json({ message: "Check your email to verify your account." });
}

export async function POST(request: Request) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const ip = getClientIp(request);
  if (ip) {
    const ipCheck = await checkRateLimit(`register:ip:${ip}`, RATE_LIMITS.registerPerIp);
    if (!ipCheck.allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input.", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  // Honeypot: pretend success without doing anything real.
  if (data.website) {
    return genericSuccess();
  }

  const emailCheck = await checkRateLimit(
    `register:email:${data.email}`,
    RATE_LIMITS.registerPerEmailDaily,
  );
  if (!emailCheck.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  // No real CAPTCHA widget wired up yet — the dev provider always passes.
  // Swap in a real token from the form once a real provider exists.
  const captchaOk = await getCaptchaProvider().verify(undefined);
  if (!captchaOk) {
    return NextResponse.json({ error: "Verification failed." }, { status: 400 });
  }

  if (!isOldEnough(data.dateOfBirth)) {
    return NextResponse.json(
      { error: "You must be at least 18 years old to register." },
      { status: 400 },
    );
  }
  if (!isCountryEligible(data.country)) {
    return NextResponse.json(
      { error: "MKTrading is not currently available in your country." },
      { status: 400 },
    );
  }

  const [existing] = await db.select().from(users).where(eq(users.email, data.email));
  if (existing) {
    // Anti-enumeration: identical response either way; notify the real
    // owner instead of leaking existence via a form error.
    await getEmailProvider().send({
      userId: existing.id,
      to: existing.email,
      type: "security_alert",
      subject: "Someone tried to register with your email",
      body: "Someone attempted to create a new MKTrading account using your email address. If this wasn't you, no action is needed. If you're missing access to your own account, use the Forgot Password page instead.",
    });
    return genericSuccess();
  }

  const passwordHash = await hashPassword(data.password);

  const newUser = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email: data.email, phone: data.phone, passwordHash })
      .returning();
    if (!user) throw new Error("Failed to create user.");

    await tx.insert(profiles).values({
      userId: user.id,
      fullName: data.fullName,
      country: data.country,
      dateOfBirth: data.dateOfBirth.toISOString().slice(0, 10),
      termsAcceptedAt: new Date(),
      riskDisclosureAcceptedAt: new Date(),
    });

    const [userRole] = await tx.select().from(roles).where(eq(roles.name, "USER"));
    if (userRole) {
      await tx.insert(userRoles).values({ userId: user.id, roleId: userRole.id });
    }

    return user;
  });

  const verificationToken = generateToken();
  await db.insert(emailVerificationTokens).values({
    userId: newUser.id,
    tokenHash: hashToken(verificationToken),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
  });

  // Built from our own trusted SITE_URL constant, never from the
  // request's Host header — a link built from request.url's origin would
  // be a host-header-injection risk in an emailed verification link.
  const verifyUrl = new URL("/verify-email", SITE_URL);
  verifyUrl.searchParams.set("token", verificationToken);

  await getEmailProvider().send({
    userId: newUser.id,
    to: newUser.email,
    type: "account_created",
    subject: "Verify your MKTrading account",
    body: `Welcome to MKTrading. Verify your email to finish setting up your account: ${verifyUrl.toString()}`,
    link: verifyUrl.toString(),
  });

  return genericSuccess();
}
