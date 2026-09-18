import { desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { SessionsList, type SessionRow } from "@/components/account/sessions-list";
import { MfaSection } from "@/components/account/mfa-section";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { getCurrentUser } from "@/lib/auth/dal";
import { isMfaEnabled } from "@/lib/auth/mfa";
import { listActiveSessions, verifyAndRefreshSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { loginEvents } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout already redirects unauthenticated requests

  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const currentSession = currentToken ? await verifyAndRefreshSession(currentToken) : null;

  const [activeSessions, recentLogins, mfaEnabled] = await Promise.all([
    listActiveSessions(user.id),
    db
      .select()
      .from(loginEvents)
      .where(eq(loginEvents.userId, user.id))
      .orderBy(desc(loginEvents.createdAt))
      .limit(10),
    isMfaEnabled(user.id),
  ]);

  const sessionRows: SessionRow[] = activeSessions.map((session) => ({
    id: session.id,
    lastActiveAt: session.lastActiveAt.toISOString(),
    userAgent: session.userAgent,
    ip: session.ip,
    isCurrent: session.id === currentSession?.id,
  }));

  return (
    <Container className="flex flex-col gap-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">Security</h1>

      <ChangePasswordForm />
      <MfaSection initiallyEnabled={mfaEnabled} />
      <SessionsList sessions={sessionRows} />

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold text-foreground">Recent login activity</h2>
        {recentLogins.length === 0 ? (
          <p className="text-sm text-muted-foreground">No login activity yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentLogins.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-foreground">{event.ip ?? "Unknown IP"}</span>
                  <span className="text-xs text-muted-foreground">{event.userAgent ?? "Unknown device"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={event.success ? "positive" : "negative"}>
                    {event.success ? "Success" : "Failed"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {event.createdAt.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Container>
  );
}
