import { and, eq, isNull } from "drizzle-orm";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { db } from "@/lib/db/client";
import { mfaBackupCodes, mfaCredentials } from "@/lib/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/auth/crypto";
import { generateToken, hashToken } from "@/lib/auth/tokens";

const ISSUER = "MKTrading";
const BACKUP_CODE_COUNT = 10;
// +/- one 30s step. A wider tolerance meaningfully widens the window an
// attacker can guess a code in.
const EPOCH_TOLERANCE_SECONDS = 30;

async function verifyCode(secret: string, token: string): Promise<boolean> {
  const result = await verify({ secret, token, epochTolerance: EPOCH_TOLERANCE_SECONDS });
  return result.valid;
}

export interface MfaEnrollment {
  secret: string;
  uri: string;
  qrDataUrl: string;
}

/** Secret is stored encrypted immediately, but verifiedAt stays null until
 * confirmMfaEnrollment proves the user actually captured it — MFA isn't
 * "enabled" the instant a secret is generated. */
export async function beginMfaEnrollment(
  userId: string,
  accountLabel: string,
): Promise<MfaEnrollment> {
  const secret = generateSecret();
  const uri = generateURI({ issuer: ISSUER, label: accountLabel, secret });
  const qrDataUrl = await QRCode.toDataURL(uri);
  const secretEncrypted = encryptSecret(secret);

  await db
    .insert(mfaCredentials)
    .values({ userId, secretEncrypted })
    .onConflictDoUpdate({
      target: mfaCredentials.userId,
      set: { secretEncrypted, verifiedAt: null, createdAt: new Date() },
    });

  return { secret, uri, qrDataUrl };
}

export async function confirmMfaEnrollment(userId: string, code: string): Promise<boolean> {
  const [credential] = await db
    .select()
    .from(mfaCredentials)
    .where(eq(mfaCredentials.userId, userId));
  if (!credential) return false;

  const valid = await verifyCode(decryptSecret(credential.secretEncrypted), code);
  if (!valid) return false;

  await db
    .update(mfaCredentials)
    .set({ verifiedAt: new Date(), lastUsedAt: new Date() })
    .where(eq(mfaCredentials.userId, userId));
  return true;
}

export async function isMfaEnabled(userId: string): Promise<boolean> {
  const [credential] = await db
    .select()
    .from(mfaCredentials)
    .where(eq(mfaCredentials.userId, userId));
  return Boolean(credential?.verifiedAt);
}

export async function verifyMfaCode(userId: string, code: string): Promise<boolean> {
  const [credential] = await db
    .select()
    .from(mfaCredentials)
    .where(eq(mfaCredentials.userId, userId));
  if (!credential || !credential.verifiedAt) return false;

  const valid = await verifyCode(decryptSecret(credential.secretEncrypted), code);
  if (valid) {
    await db
      .update(mfaCredentials)
      .set({ lastUsedAt: new Date() })
      .where(eq(mfaCredentials.userId, userId));
  }
  return valid;
}

/** Caller must have already re-checked the password/a valid code in the
 * same request — this function itself performs no such re-auth check. */
export async function disableMfa(userId: string): Promise<void> {
  await db.delete(mfaCredentials).where(eq(mfaCredentials.userId, userId));
  await db.delete(mfaBackupCodes).where(eq(mfaBackupCodes.userId, userId));
}

/** Codes are returned once, here, and never retrievable again — only
 * their hashes are stored. Regenerating invalidates the whole previous
 * batch atomically. */
export async function generateBackupCodes(userId: string): Promise<string[]> {
  const batchId = crypto.randomUUID();
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, () => generateToken().slice(0, 10));

  await db.transaction(async (tx) => {
    await tx.delete(mfaBackupCodes).where(eq(mfaBackupCodes.userId, userId));
    await tx.insert(mfaBackupCodes).values(
      codes.map((code) => ({ userId, codeHash: hashToken(code), batchId })),
    );
  });

  return codes;
}

export async function verifyAndConsumeBackupCode(userId: string, code: string): Promise<boolean> {
  const codeHash = hashToken(code);
  const consumed = await db
    .update(mfaBackupCodes)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(mfaBackupCodes.userId, userId),
        eq(mfaBackupCodes.codeHash, codeHash),
        isNull(mfaBackupCodes.usedAt),
      ),
    )
    .returning({ id: mfaBackupCodes.id });

  return consumed.length > 0;
}
