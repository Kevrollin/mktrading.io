import { desc, eq } from "drizzle-orm";
import { BalanceCards } from "@/components/wallet/balance-cards";
import { RequestWithdrawalForm, type WithdrawalRow } from "@/components/wallet/request-withdrawal-form";
import { TransactionHistory } from "@/components/wallet/transaction-history";
import { Container } from "@/components/ui/container";
import { getCurrentUser } from "@/lib/auth/dal";
import { settleDueMobileMoneyDepositsForUser } from "@/lib/deposits/state-machine";
import { db } from "@/lib/db/client";
import { withdrawals } from "@/lib/db/schema";
import { getWalletSummary } from "@/lib/ledger/balances";
import { listUserTransactions } from "@/lib/ledger/transactions";
import { settleDueTradesForUser } from "@/lib/trading/state-machine";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout already redirects unauthenticated requests

  // This page is a direct-DB SSR read, not proxied through
  // /api/wallet/summary — lazy settlement has to be called here
  // explicitly too, or a user who only ever visits /app/wallet would
  // never see a due trade or mobile-money deposit resolve.
  await Promise.all([settleDueTradesForUser(user.id), settleDueMobileMoneyDepositsForUser(user.id)]);

  const [balances, transactions, myWithdrawals] = await Promise.all([
    getWalletSummary(user.id),
    listUserTransactions(user.id),
    db.select().from(withdrawals).where(eq(withdrawals.userId, user.id)).orderBy(desc(withdrawals.createdAt)),
  ]);

  const withdrawalRows: WithdrawalRow[] = myWithdrawals.map((w) => ({
    id: w.id,
    currency: w.currency,
    amount: w.amount,
    status: w.status,
    createdAt: w.createdAt.toISOString(),
    rejectionReason: w.rejectionReason,
  }));

  return (
    <Container className="flex flex-col gap-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">Wallet</h1>
      <BalanceCards balances={balances} />
      <RequestWithdrawalForm balances={balances} withdrawals={withdrawalRows} />
      <TransactionHistory transactions={transactions} />
    </Container>
  );
}
