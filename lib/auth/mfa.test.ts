import { sql } from "drizzle-orm";
import { generate, generateSecret } from "otplib";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { createTestUser } from "@/lib/db/test-utils";
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  generateBackupCodes,
  verifyAndConsumeBackupCode,
  verifyMfaCode,
} from "@/lib/auth/mfa";

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE mfa_credentials, mfa_backup_codes, users CASCADE`);
});

describe("TOTP enrollment + verification", () => {
  it("verifies a correct code once enrollment is confirmed", async () => {
    const user = await createTestUser();
    const { secret } = await beginMfaEnrollment(user.id, user.email);

    const confirmed = await confirmMfaEnrollment(user.id, await generate({ secret }));
    expect(confirmed).toBe(true);

    await expect(verifyMfaCode(user.id, await generate({ secret }))).resolves.toBe(true);
  });

  it("rejects a code generated from the wrong secret", async () => {
    const user = await createTestUser();
    const { secret } = await beginMfaEnrollment(user.id, user.email);
    await confirmMfaEnrollment(user.id, await generate({ secret }));

    const wrongSecret = generateSecret();
    const wrongCode = await generate({ secret: wrongSecret });

    await expect(verifyMfaCode(user.id, wrongCode)).resolves.toBe(false);
  });

  it("does not verify before enrollment is confirmed", async () => {
    const user = await createTestUser();
    const { secret } = await beginMfaEnrollment(user.id, user.email);

    await expect(verifyMfaCode(user.id, await generate({ secret }))).resolves.toBe(false);
  });

  it("rejects a code outside the time-step tolerance (injected epoch, not sleep)", async () => {
    const user = await createTestUser();
    const { secret } = await beginMfaEnrollment(user.id, user.email);
    await confirmMfaEnrollment(user.id, await generate({ secret }));

    // A code generated for 10 minutes from now is well outside the +/-30s
    // tolerance checked against the real current time.
    const farFutureEpoch = Math.floor(Date.now() / 1000) + 600;
    const farFutureCode = await generate({ secret, epoch: farFutureEpoch });

    await expect(verifyMfaCode(user.id, farFutureCode)).resolves.toBe(false);
  });
});

describe("backup codes", () => {
  it("verifies a valid backup code once, then rejects reuse", async () => {
    const user = await createTestUser();
    const codes = await generateBackupCodes(user.id);
    const [code] = codes;

    await expect(verifyAndConsumeBackupCode(user.id, code!)).resolves.toBe(true);
    await expect(verifyAndConsumeBackupCode(user.id, code!)).resolves.toBe(false);
  });

  it("rejects an unknown code", async () => {
    const user = await createTestUser();
    await generateBackupCodes(user.id);

    await expect(verifyAndConsumeBackupCode(user.id, "not-a-real-code")).resolves.toBe(false);
  });

  it("regenerating invalidates the previous batch", async () => {
    const user = await createTestUser();
    const firstBatch = await generateBackupCodes(user.id);
    await generateBackupCodes(user.id);

    await expect(verifyAndConsumeBackupCode(user.id, firstBatch[0]!)).resolves.toBe(false);
  });
});
