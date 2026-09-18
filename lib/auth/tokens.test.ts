import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "@/lib/auth/tokens";

describe("generateToken", () => {
  it("generates tokens with sufficient length/entropy", () => {
    const token = generateToken();
    // 32 raw bytes, base64url-encoded, is at least 32 chars.
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  it("generates different tokens on each call", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });
});

describe("hashToken", () => {
  it("is deterministic for the same input", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("produces different hashes for different inputs", () => {
    const a = generateToken();
    const b = generateToken();
    expect(hashToken(a)).not.toBe(hashToken(b));
  });

  it("produces a hex-encoded SHA-256 digest", () => {
    const digest = hashToken("fixed-input-for-this-test");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});
