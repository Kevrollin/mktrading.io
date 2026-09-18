import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rateLimitBuckets } from "@/lib/db/schema";

export interface RateLimitRule {
  windowMs: number;
  limit: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/** One atomic INSERT ... ON CONFLICT ... DO UPDATE SET count = count + 1
 * RETURNING count — never read-then-write, which has a TOCTOU race that's
 * exploitable by concurrent requests (exactly when a rate limit matters
 * most). `now` is injectable so tests can move across a window boundary
 * without sleeping. */
export async function checkRateLimit(
  key: string,
  rule: RateLimitRule,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const windowStart = new Date(Math.floor(now.getTime() / rule.windowMs) * rule.windowMs);

  const [row] = await db
    .insert(rateLimitBuckets)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitBuckets.key, rateLimitBuckets.windowStart],
      set: { count: sql`${rateLimitBuckets.count} + 1` },
    })
    .returning({ count: rateLimitBuckets.count });

  const count = row?.count ?? 1;
  return { allowed: count <= rule.limit, remaining: Math.max(0, rule.limit - count) };
}
