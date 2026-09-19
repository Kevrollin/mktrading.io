import { randomBytes } from "node:crypto";

// Excludes ambiguous characters (0/O, 1/I, L) that are easy to misread
// or mistype when a user is quoting this code back to support/an admin.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

/** Rejection sampling, not modulo of a raw byte — ALPHABET.length (31)
 * isn't a power of two, so a plain `byte % 31` would be slightly biased
 * toward the low end of the alphabet. */
function randomAlphabetChar(): string {
  const maxValid = 256 - (256 % ALPHABET.length);
  let byte: number;
  do {
    byte = randomBytes(1)[0]!;
  } while (byte >= maxValid);
  return ALPHABET[byte % ALPHABET.length]!;
}

/** node:crypto randomBytes, never Math.random — matches
 * lib/auth/tokens.ts's convention for anything user-facing/security-
 * adjacent. */
export function generateReferenceCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += randomAlphabetChar();
  }
  return `DEP-${code}`;
}

const PG_UNIQUE_VIOLATION = "23505";
const MAX_ATTEMPTS = 5;

/**
 * Retries the caller's insert on a reference_code unique-violation with a
 * fresh code each attempt, rather than check-then-insert (which would
 * race) — mirrors the retry-on-conflict shape lib/ledger/accounts.ts's
 * getOrCreateAccount() uses. Only retries on the reference_code
 * constraint specifically (checked by name, not just SQLSTATE 23505) —
 * blindly retrying on any unique violation could mask a real
 * idempotency-key collision by silently creating a second row instead of
 * surfacing it.
 */
export async function createDepositWithUniqueReferenceCode<T>(
  insert: (referenceCode: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await insert(generateReferenceCode());
    } catch (error) {
      const pgError = error as { code?: string; constraint_name?: string };
      const isReferenceCodeCollision =
        pgError.code === PG_UNIQUE_VIOLATION && pgError.constraint_name === "deposits_reference_code_key";
      if (!isReferenceCodeCollision || attempt === MAX_ATTEMPTS - 1) {
        throw error;
      }
    }
  }
  throw new Error("Failed to generate a unique deposit reference code.");
}
