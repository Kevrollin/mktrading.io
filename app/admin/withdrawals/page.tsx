import { desc, inArray } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { db } from "@/lib/db/client";
import { withdrawals } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const QUEUE_STATUSES = ["PENDING_APPROVAL", "EXECUTION_AUTHORIZED", "PROCESSING"] as const;

export default async function AdminWithdrawalsPage() {
  const queue = await db
    .select()
    .from(withdrawals)
    .where(inArray(withdrawals.status, QUEUE_STATUSES))
    .orderBy(desc(withdrawals.createdAt));

  return (
    <Container className="flex flex-col gap-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">Withdrawal approvals</h1>
      <Card className="flex flex-col gap-2 p-6">
        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground">No withdrawals need attention right now.</p>
        ) : (
          queue.map((withdrawal) => (
            <Link
              key={withdrawal.id}
              href={`/admin/withdrawals/${withdrawal.id}`}
              className="flex items-center justify-between gap-3 rounded-[var(--radius)] border-b border-border p-3 text-sm transition-colors last:border-0 hover:bg-muted"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground">
                  {withdrawal.amount} {withdrawal.currency}
                </span>
                <span className="text-xs text-muted-foreground">
                  {withdrawal.createdAt.toLocaleString()}
                </span>
              </div>
              <Badge variant="warning">{withdrawal.status.replaceAll("_", " ")}</Badge>
            </Link>
          ))
        )}
      </Card>
    </Container>
  );
}
