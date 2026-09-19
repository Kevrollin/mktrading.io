import { Card } from "@/components/ui/card";
import type { CurrencyBalance } from "@/lib/ledger/balances";

const isZero = (value: string) => /^0+(\.0*)?$/.test(value);

export function BalanceCards({ balances }: { balances: CurrencyBalance[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {balances.map((balance) => (
        <Card key={balance.currency} className="flex flex-col gap-2 p-6">
          <span className="text-sm text-muted-foreground">{balance.currency}</span>
          <span className="text-2xl font-semibold text-foreground">{balance.available}</span>
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {!isZero(balance.locked) ? <span>Locked: {balance.locked}</span> : null}
            {!isZero(balance.pendingWithdrawal) ? (
              <span>Pending withdrawal: {balance.pendingWithdrawal}</span>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
