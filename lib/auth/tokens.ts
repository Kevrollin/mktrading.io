import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32; // 256 bits of entropy

/** For session/verification/reset tokens — the raw value that goes in a
 * cookie or an emailed link. Only its hash (see hashToken) is ever stored. */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Plain SHA-256, deliberately not Argon2id: these tokens already carry
 * 256 bits of entropy, so a slow password-hashing KDF would only waste CPU
 * without adding any real resistance — Argon2id is for low-entropy,
 * human-chosen secrets. Lookups are by exact indexed equality in Postgres,
 * not an in-process string compare, so a timing-safe compare isn't the
 * relevant defense here either. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
