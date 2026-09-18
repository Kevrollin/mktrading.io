import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { checkRateLimit } from "@/lib/auth/rate-limit";

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE rate_limit_buckets`);
});

describe("checkRateLimit", () => {
  it("allows requests under the limit", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const rule = { windowMs: 60_000, limit: 3 };

    const first = await checkRateLimit(key, rule);
    const second = await checkRateLimit(key, rule);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
  });

  it("rejects the request that pushes the count past the limit", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const rule = { windowMs: 60_000, limit: 2 };

    await checkRateLimit(key, rule);
    await checkRateLimit(key, rule);
    const third = await checkRateLimit(key, rule);

    expect(third.allowed).toBe(false);
  });

  it("does not let two different keys interfere with each other", async () => {
    const rule = { windowMs: 60_000, limit: 1 };
    const keyA = `test:${crypto.randomUUID()}`;
    const keyB = `test:${crypto.randomUUID()}`;

    const a = await checkRateLimit(keyA, rule);
    const b = await checkRateLimit(keyB, rule);

    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });

  it("resets the count once the window rolls over (injected time, no sleep)", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const rule = { windowMs: 1000, limit: 1 };

    const windowOneStart = new Date(Math.floor(Date.now() / rule.windowMs) * rule.windowMs);
    const windowTwoStart = new Date(windowOneStart.getTime() + rule.windowMs);

    const first = await checkRateLimit(key, rule, windowOneStart);
    const second = await checkRateLimit(key, rule, windowOneStart);
    const thirdInNextWindow = await checkRateLimit(key, rule, windowTwoStart);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(thirdInNextWindow.allowed).toBe(true);
  });

  // The one test that actually proves the atomic upsert avoids the TOCTOU
  // race: a read-then-write implementation would let more than `limit`
  // requests through here, and this would silently start failing.
  it("under concurrent load, allows exactly `limit` requests and no more", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const rule = { windowMs: 60_000, limit: 5 };
    const concurrentRequests = 20;

    const results = await Promise.all(
      Array.from({ length: concurrentRequests }, () => checkRateLimit(key, rule)),
    );

    const allowedCount = results.filter((result) => result.allowed).length;
    expect(allowedCount).toBe(rule.limit);
  });
});
