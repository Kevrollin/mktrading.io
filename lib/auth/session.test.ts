import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { createTestUser } from "@/lib/db/test-utils";
import {
  issueSession,
  listActiveSessions,
  revokeAllSessions,
  revokeSession,
  rotateSession,
  verifyAndRefreshSession,
} from "@/lib/auth/session";

afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE sessions, users CASCADE`);
});

describe("session lifecycle", () => {
  it("resolves a freshly issued session", async () => {
    const user = await createTestUser();
    const { token } = await issueSession({ userId: user.id });

    const resolved = await verifyAndRefreshSession(token);
    expect(resolved?.userId).toBe(user.id);
  });

  it("does not resolve a revoked session", async () => {
    const user = await createTestUser();
    const { token } = await issueSession({ userId: user.id });
    const resolved = await verifyAndRefreshSession(token);
    await revokeSession(resolved!.id, user.id);

    await expect(verifyAndRefreshSession(token)).resolves.toBeNull();
  });

  it("does not resolve an unknown token", async () => {
    await expect(verifyAndRefreshSession("not-a-real-token")).resolves.toBeNull();
  });

  it("slides expiresAt forward on use, never past absoluteExpiresAt", async () => {
    const user = await createTestUser();
    const { token } = await issueSession({ userId: user.id });
    const first = await verifyAndRefreshSession(token);

    const second = await verifyAndRefreshSession(token);
    expect(second!.expiresAt.getTime()).toBeGreaterThanOrEqual(first!.expiresAt.getTime());
    expect(second!.expiresAt.getTime()).toBeLessThanOrEqual(second!.absoluteExpiresAt.getTime());
  });

  it("rotation invalidates the old token while the new one resolves", async () => {
    const user = await createTestUser();
    const { token: oldToken } = await issueSession({ userId: user.id });
    const oldSession = await verifyAndRefreshSession(oldToken);

    const { token: newToken } = await rotateSession(oldSession!.id, { userId: user.id });

    await expect(verifyAndRefreshSession(oldToken)).resolves.toBeNull();
    await expect(verifyAndRefreshSession(newToken)).resolves.not.toBeNull();
  });

  it("revoke-all leaves exactly the expected surviving set", async () => {
    const user = await createTestUser();
    const a = await issueSession({ userId: user.id });
    const b = await issueSession({ userId: user.id });
    const aResolved = await verifyAndRefreshSession(a.token);

    await revokeAllSessions(user.id, { exceptSessionId: aResolved!.id });

    await expect(verifyAndRefreshSession(a.token)).resolves.not.toBeNull();
    await expect(verifyAndRefreshSession(b.token)).resolves.toBeNull();

    const active = await listActiveSessions(user.id);
    expect(active).toHaveLength(1);
    expect(active[0]!.id).toBe(aResolved!.id);
  });

  it("revoke-all with no exception clears every session", async () => {
    const user = await createTestUser();
    const a = await issueSession({ userId: user.id });
    const b = await issueSession({ userId: user.id });

    await revokeAllSessions(user.id);

    await expect(verifyAndRefreshSession(a.token)).resolves.toBeNull();
    await expect(verifyAndRefreshSession(b.token)).resolves.toBeNull();
  });
});
