import { desc, eq } from "drizzle-orm";
import { CryptoDepositForm } from "@/components/deposits/crypto-deposit-form";
import { DepositHistory, type DepositRow } from "@/components/deposits/deposit-history";
import { MobileMoneyDepositForm } from "@/components/deposits/mobile-money-deposit-form";
import { Container } from "@/components/ui/container";
import { getCurrentUser } from "@/lib/auth/dal";
import { settleDueMobileMoneyDepositsForUser } from "@/lib/deposits/state-machine";
import { db } from "@/lib/db/client";
import { deposits, users } from "@/lib/db/schema";
import { listPlatformWallets } from "@/lib/platform-wallets/service";

export const dynamic = "force-dynamic";

export default async function DepositsPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout already redirects unauthenticated requests

  // Direct-DB SSR read, not proxied through GET /api/deposits — call the
  // lazy-settlement path here directly too, same reasoning as
  // app/app/wallet/page.tsx.
  await settleDueMobileMoneyDepositsForUser(user.id);

  const [wallets, myDeposits, userRow] = await Promise.all([
    listPlatformWallets(),
    db.select().from(deposits).where(eq(deposits.userId, user.id)).orderBy(desc(deposits.placedAt)).limit(50),
    db.select({ phone: users.phone }).from(users).where(eq(users.id, user.id)).then(([row]) => row),
  ]);

  // Only currencies a SUPER_ADMIN has actually configured an address for
  // are offered — see lib/platform-wallets/service.ts.
  const cryptoWallets = wallets.filter((wallet) => wallet.kind === "CRYPTO" && wallet.address);

  const depositRows: DepositRow[] = myDeposits.map((d) => ({
    id: d.id,
    currency: d.currency,
    method: d.method,
    status: d.status,
    requestedAmount: d.requestedAmount,
    confirmedAmount: d.confirmedAmount,
    referenceCode: d.referenceCode,
    destinationAddress: d.destinationAddress,
    rejectionReason: d.rejectionReason,
    placedAt: d.placedAt.toISOString(),
  }));

  return (
    <Container className="flex flex-col gap-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">Deposits</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <CryptoDepositForm wallets={cryptoWallets.map((w) => ({ currency: w.currency }))} />
        <MobileMoneyDepositForm defaultPhone={userRow?.phone ?? ""} />
      </div>
      <DepositHistory initialDeposits={depositRows} />
    </Container>
  );
}
