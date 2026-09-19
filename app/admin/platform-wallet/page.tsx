import { PlatformWalletForm } from "@/components/admin/platform-wallet-form";
import { Container } from "@/components/ui/container";
import { requireSuperAdmin } from "@/lib/auth/rbac";
import { listPlatformWallets } from "@/lib/platform-wallets/service";

export const dynamic = "force-dynamic";

export default async function PlatformWalletPage() {
  // requireAdmin() in the layout already let any of the 5 admin roles
  // through — this page's contents are more sensitive than that (pasting
  // the wrong address here misdirects real deposits), so it re-gates to
  // SUPER_ADMIN specifically.
  await requireSuperAdmin();

  const wallets = await listPlatformWallets();
  const cryptoWallets = wallets.filter((wallet) => wallet.kind === "CRYPTO");

  return (
    <Container className="flex flex-col gap-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Platform wallet</h1>
        <p className="text-sm text-muted-foreground">
          The address customer crypto deposits are sent to. Only Super Admins can view or change this.
        </p>
      </div>
      <PlatformWalletForm
        wallets={cryptoWallets.map((wallet) => ({
          currency: wallet.currency,
          address: wallet.address,
          updatedAt: wallet.updatedAt ? wallet.updatedAt.toISOString() : null,
        }))}
      />
    </Container>
  );
}
