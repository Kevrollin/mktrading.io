import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { db } from "@/lib/db/client";
import { deposits } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminDepositsPage() {
  const queue = await db
    .select()
    .from(deposits)
    .where(eq(deposits.status, "PENDING"))
    .orderBy(desc(deposits.placedAt));

  return (
    <Container className="flex flex-col gap-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">Deposit requests</h1>
      <Card className="flex flex-col gap-2 p-6">
        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deposits need attention right now.</p>
        ) : (
          queue.map((deposit) => (
            <Link
              key={deposit.id}
              href={`/admin/deposits/${deposit.id}`}
              className="flex items-center justify-between gap-3 rounded-[var(--radius)] border-b border-border p-3 text-sm transition-colors last:border-0 hover:bg-muted"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground">
                  {deposit.requestedAmount} {deposit.currency} · {deposit.method === "CRYPTO" ? "Crypto" : "M-Pesa"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {deposit.referenceCode} — {deposit.placedAt.toLocaleString()}
                </span>
              </div>
              <Badge variant="warning">{deposit.status}</Badge>
            </Link>
          ))
        )}
      </Card>
    </Container>
  );
}
