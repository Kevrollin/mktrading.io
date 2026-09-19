import { randomBytes } from "node:crypto";
import type { RoleName } from "@/lib/db/schema";

// Nothing currently exists to test the 5-of-5 approval flow against — one
// account per admin role, obviously fake email domain, MFA pre-verified
// (no live confirmation round-trip since this is a script, not a user).
const DEMO_ADMIN_ROLES: RoleName[] = [
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "COMPLIANCE_ADMIN",
  "OPERATIONS_ADMIN",
  "RISK_ADMIN",
];

const DEMO_EMAIL_DOMAIN = "demo.mktradingv1.internal";

function emailFor(role: RoleName): string {
  return `${role.toLowerCase().replaceAll("_", "-")}@${DEMO_EMAIL_DOMAIN}`;
}

function phoneFor(index: number): string {
  return `+1555000${String(index).padStart(4, "0")}`;
}

/** 24 random bytes -> 32 base64url chars: well above the 12-char minimum
 * and never a dictionary word, so it can't collide with the common-
 * password/personal-info checks real signups go through. */
function generateDemoPassword(): string {
  return randomBytes(24).toString("base64url");
}

async function main() {
  // Loaded here, before any module that reads DATABASE_URL at import time
  // (lib/db/client.ts) is dynamically imported below — a static top-level
  // `import` would be hoisted above this by the CJS transform and blow up
  // with "DATABASE_URL is not set."
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Fine in CI, where real env vars are injected directly.
  }

  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    console.error(
      "Refusing to seed demo admin accounts in production without --force.\n" +
        "These are throwaway credentials with pre-verified MFA — never run this against\n" +
        "a real production database unless you specifically mean to.",
    );
    process.exit(1);
  }

  const { eq } = await import("drizzle-orm");
  const { generateSecret, generateURI } = await import("otplib");
  const { db } = await import("@/lib/db/client");
  const { encryptSecret } = await import("@/lib/auth/crypto");
  const { hashPassword } = await import("@/lib/auth/password");
  const { mfaCredentials, profiles, roles, userRoles, users } = await import("@/lib/db/schema");

  console.log("Seeding demo admin accounts — safe to re-run; each run issues fresh credentials.\n");

  for (const [index, role] of DEMO_ADMIN_ROLES.entries()) {
    const [roleRow] = await db.select().from(roles).where(eq(roles.name, role));
    if (!roleRow) {
      throw new Error(`Role ${role} is not seeded — run supabase/seed.sql first.`);
    }

    const email = emailFor(role);
    const password = generateDemoPassword();
    const passwordHash = await hashPassword(password);
    const secret = generateSecret();
    const secretEncrypted = encryptSecret(secret);
    const uri = generateURI({ issuer: "MKTrading", label: email, secret });

    const [existing] = await db.select().from(users).where(eq(users.email, email));

    const user = existing
      ? (
          await db
            .update(users)
            .set({ passwordHash, status: "active", updatedAt: new Date() })
            .where(eq(users.id, existing.id))
            .returning()
        )[0]!
      : (
          await db
            .insert(users)
            .values({
              email,
              phone: phoneFor(index),
              passwordHash,
              emailVerifiedAt: new Date(),
            })
            .returning()
        )[0]!;

    await db
      .insert(profiles)
      .values({
        userId: user.id,
        fullName: `${role.replaceAll("_", " ")} (Demo)`,
        country: "KE",
        dateOfBirth: "1990-01-01",
        termsAcceptedAt: new Date(),
        riskDisclosureAcceptedAt: new Date(),
      })
      .onConflictDoNothing();

    await db.insert(userRoles).values({ userId: user.id, roleId: roleRow.id }).onConflictDoNothing();

    await db
      .insert(mfaCredentials)
      .values({ userId: user.id, secretEncrypted, verifiedAt: new Date() })
      .onConflictDoUpdate({
        target: mfaCredentials.userId,
        set: { secretEncrypted, verifiedAt: new Date(), createdAt: new Date(), lastUsedAt: null },
      });

    console.log(`${role}`);
    console.log(`  email:      ${email}`);
    console.log(`  password:   ${password}`);
    console.log(`  MFA secret: ${secret}`);
    console.log(`  MFA URI:    ${uri}`);
    console.log("");
  }

  console.log("Done. These credentials are shown once here — save them now if you need them.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed to seed demo admin accounts:", error);
  process.exit(1);
});
