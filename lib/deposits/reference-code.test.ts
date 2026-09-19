import { describe, expect, it } from "vitest";
import { createDepositWithUniqueReferenceCode, generateReferenceCode } from "@/lib/deposits/reference-code";

const DISALLOWED_CHARS = ["0", "O", "1", "I", "L"];

describe("generateReferenceCode", () => {
  it("has the expected format and prefix", () => {
    const code = generateReferenceCode();
    expect(code).toMatch(/^DEP-[A-Z0-9]{6}$/);
  });

  it("never contains ambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateReferenceCode();
      for (const char of DISALLOWED_CHARS) {
        expect(code).not.toContain(char);
      }
    }
  });

  it("produces no collisions across a large sample", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      codes.add(generateReferenceCode());
    }
    expect(codes.size).toBe(5000);
  });
});

describe("createDepositWithUniqueReferenceCode", () => {
  it("returns the insert's result on the first successful attempt", async () => {
    const result = await createDepositWithUniqueReferenceCode(async (code) => {
      expect(code).toMatch(/^DEP-/);
      return { id: "fake-id", code };
    });
    expect(result.id).toBe("fake-id");
  });

  it("retries with a fresh code after a reference_code unique-violation, and eventually succeeds", async () => {
    let attempts = 0;
    const seenCodes: string[] = [];

    const result = await createDepositWithUniqueReferenceCode(async (code) => {
      attempts += 1;
      seenCodes.push(code);
      if (attempts < 3) {
        const error = new Error("duplicate key value violates unique constraint") as Error & {
          code?: string;
          constraint_name?: string;
        };
        error.code = "23505";
        error.constraint_name = "deposits_reference_code_key";
        throw error;
      }
      return { code };
    });

    expect(attempts).toBe(3);
    expect(new Set(seenCodes).size).toBe(3); // a fresh code was generated each attempt
    expect(result.code).toBe(seenCodes[2]);
  });

  it("does not retry on an unrelated unique-violation (e.g. idempotency key collision)", async () => {
    const error = new Error("duplicate key value violates unique constraint") as Error & {
      code?: string;
      constraint_name?: string;
    };
    error.code = "23505";
    error.constraint_name = "deposits_user_id_idempotency_key_unique";

    let attempts = 0;
    await expect(
      createDepositWithUniqueReferenceCode(async () => {
        attempts += 1;
        throw error;
      }),
    ).rejects.toThrow(error);
    expect(attempts).toBe(1); // no retry — blindly retrying could mask a real idempotency violation
  });

  it("does not swallow a non-Postgres error", async () => {
    await expect(
      createDepositWithUniqueReferenceCode(async () => {
        throw new Error("something else entirely");
      }),
    ).rejects.toThrow("something else entirely");
  });
});
