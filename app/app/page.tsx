import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { getCurrentUser } from "@/lib/auth/dal";

export default async function AppOverviewPage() {
  const user = await getCurrentUser();

  return (
    <Container className="flex flex-col gap-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">
        Welcome back{user ? `, ${user.email}` : ""}
      </h1>
      <Card className="p-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          You&apos;re logged in. The full trading dashboard — wallet, markets, trade history —
          launches in a later milestone. For now, manage your account using the links above.
        </p>
      </Card>
    </Container>
  );
}
