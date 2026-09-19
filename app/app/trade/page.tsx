import { TradingDesk } from "@/components/trading/trading-desk";
import { Container } from "@/components/ui/container";
import { getCurrentUser } from "@/lib/auth/dal";
import { getWalletSummary } from "@/lib/ledger/balances";
import { listInstruments } from "@/lib/trading/instruments-service";
import { settleDueTradesForUser } from "@/lib/trading/state-machine";

export const dynamic = "force-dynamic";

export default async function TradePage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout already redirects unauthenticated requests

  await settleDueTradesForUser(user.id);

  const [instruments, balances] = await Promise.all([listInstruments(true), getWalletSummary(user.id)]);

  return (
    <Container className="flex flex-col gap-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">Trade</h1>
      <TradingDesk instruments={instruments} balances={balances} />
    </Container>
  );
}
