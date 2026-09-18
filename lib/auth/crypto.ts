import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const encoded = process.env.MFA_ENCRYPTION_KEY;
  if (!encoded) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MFA_ENCRYPTION_KEY is required in production.");
    }
    console.warn(
      "[dev] MFA_ENCRYPTION_KEY is not set — using an insecure fixed development key. Never use this in production.",
    );
    return Buffer.from("0".repeat(32));
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("MFA_ENCRYPTION_KEY must decode to exactly 32 bytes (openssl rand -base64 32).");
  }
  return key;
}

/** AES-256-GCM encrypt. Used only for TOTP secrets at rest — never for
 * tokens/passwords, which use different mechanisms (hashing, not
 * reversible encryption). */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(packed: string): string {
  const key = getKey();
  const [ivB64, tagB64, ciphertextB64] = packed.split(":");
  if (!ivB64 || !tagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted secret.");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
