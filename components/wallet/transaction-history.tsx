import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { UserTransactionRow } from "@/lib/ledger/transactions";

const DIRECTION_LABEL: Record<UserTransactionRow["direction"], string> = {
  credit: "In",
  debit: "Out",
  internal: "Internal",
};

const DIRECTION_VARIANT: Record<UserTransactionRow["direction"], "positive" | "negative" | "neutral"> = {
  credit: "positive",
  debit: "negative",
  internal: "neutral",
};

export function TransactionHistory({ transactions }: { transactions: UserTransactionRow[] }) {
  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold text-foreground">Transaction history</h2>
      {transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transactions yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground">{tx.transactionType.replaceAll("_", " ")}</span>
                <span className="text-xs text-muted-foreground">{tx.reference}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={DIRECTION_VARIANT[tx.direction]}>{DIRECTION_LABEL[tx.direction]}</Badge>
                <span className="text-foreground">
                  {tx.amount} {tx.currency}
                </span>
                <span className="text-xs text-muted-foreground">{tx.createdAt.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
