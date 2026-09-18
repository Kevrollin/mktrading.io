import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { db } from "@/lib/db/client";
import { notifications, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

interface DevEmailPayload {
  to?: string;
  subject?: string;
  body?: string;
  link?: string | null;
}

export default async function DevInboxPage() {
  if (process.env.NODE_ENV === "production" || (process.env.EMAIL_PROVIDER ?? "dev") !== "dev") {
    notFound();
  }

  const rows = await db
    .select({ notification: notifications, userEmail: users.email })
    .from(notifications)
    .innerJoin(users, eq(notifications.userId, users.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return (
    <Container className="flex flex-col gap-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dev email inbox</h1>
        <p className="text-sm text-muted-foreground">
          Development only — shows what the dev EmailProvider &quot;sent&quot; instead of a real
          mailbox.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No emails yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map(({ notification, userEmail }) => {
            const payload = notification.payload as DevEmailPayload;
            return (
              <Card key={notification.id} className="flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {payload.subject ?? notification.type}
                  </p>
                  <Badge variant="neutral">{notification.type}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">To: {payload.to ?? userEmail}</p>
                <p className="text-sm text-muted-foreground">{payload.body}</p>
                {payload.link ? (
                  <a
                    href={payload.link}
                    className="break-all text-sm text-accent underline-offset-4 hover:underline"
                  >
                    {payload.link}
                  </a>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </Container>
  );
}
