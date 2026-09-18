import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";
import { COMMON_PASSWORDS } from "@/lib/auth/common-passwords";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/constants";

// @node-rs/argon2 exports `Algorithm` as a `const enum`, which can't be
// imported here under Next's isolatedModules tsconfig setting — 2 is
// Algorithm.Argon2id (also already the package's own default; passed
// explicitly so that stays true regardless of future default changes).
const ARGON2ID = 2;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, { algorithm: ARGON2ID });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}

const commonPasswordSet = new Set(COMMON_PASSWORDS.map((entry) => entry.toLowerCase()));

export function isCommonPassword(password: string): boolean {
  return commonPasswordSet.has(password.toLowerCase());
}

/** Cross-field check — call explicitly wherever email/name are in scope
 * (registration, change-password). Not part of passwordSchema itself,
 * since not every call site has that context. */
export function containsPersonalInfo(
  password: string,
  info: { email?: string; fullName?: string },
): boolean {
  const lower = password.toLowerCase();
  const candidates: string[] = [];

  if (info.email) {
    const localPart = info.email.split("@")[0];
    if (localPart) candidates.push(localPart.toLowerCase());
  }
  if (info.fullName) {
    candidates.push(
      ...info.fullName
        .toLowerCase()
        .split(/\s+/)
        .filter((part) => part.length >= 3),
    );
  }

  return candidates.some((candidate) => candidate.length >= 3 && lower.includes(candidate));
}

// Length + common-password check only. confirmPassword is a client-side UX
// check, never a server-side rule — it isn't part of this schema.
export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(128, "Password is too long.")
  .refine((password) => !isCommonPassword(password), {
    message: "This password is too common. Choose something less predictable.",
  });
