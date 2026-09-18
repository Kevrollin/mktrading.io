import { describe, expect, it } from "vitest";
import {
  containsPersonalInfo,
  hashPassword,
  isCommonPassword,
  passwordSchema,
  verifyPassword,
} from "@/lib/auth/password";

describe("hashPassword / verifyPassword", () => {
  it("verifies the correct password", async () => {
    const hash = await hashPassword("a-reasonably-long-passphrase-1");
    await expect(verifyPassword(hash, "a-reasonably-long-passphrase-1")).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("a-reasonably-long-passphrase-1");
    await expect(verifyPassword(hash, "a-different-passphrase-2")).resolves.toBe(false);
  });

  it("produces different hashes for the same password (proves salting)", async () => {
    const [a, b] = await Promise.all([
      hashPassword("a-reasonably-long-passphrase-1"),
      hashPassword("a-reasonably-long-passphrase-1"),
    ]);
    expect(a).not.toBe(b);
  });
});

describe("isCommonPassword", () => {
  it("flags a known common password", () => {
    expect(isCommonPassword("password123456")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isCommonPassword("PASSWORD123456")).toBe(true);
  });

  it("does not flag an unrelated password", () => {
    expect(isCommonPassword("correct-horse-battery-staple-9")).toBe(false);
  });
});

describe("containsPersonalInfo", () => {
  it("flags a password containing the email local-part", () => {
    expect(
      containsPersonalInfo("janedoe123456", { email: "janedoe@example.com" }),
    ).toBe(true);
  });

  it("flags a password containing part of the full name", () => {
    expect(containsPersonalInfo("thejanepassword", { fullName: "Jane Doe" })).toBe(true);
  });

  it("does not flag an unrelated password", () => {
    expect(
      containsPersonalInfo("unrelated123456", {
        email: "janedoe@example.com",
        fullName: "Jane Doe",
      }),
    ).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("rejects passwords shorter than the minimum length", () => {
    expect(passwordSchema.safeParse("elevenchars").success).toBe(false);
  });

  it("accepts a password at exactly the minimum length", () => {
    expect(passwordSchema.safeParse("twelvecharsX").success).toBe(true);
  });

  it("rejects a known common password even if long enough", () => {
    expect(passwordSchema.safeParse("password123456").success).toBe(false);
  });
});
