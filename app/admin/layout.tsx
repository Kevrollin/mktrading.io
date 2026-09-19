import type { ReactNode } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { Container } from "@/components/ui/container";
import { SkipLink } from "@/components/ui/skip-link";
import { Logo } from "@/components/layout/logo";
import { requireAdmin } from "@/lib/auth/rbac";

const BASE_NAV = [{ label: "Withdrawals", href: "/admin/withdrawals" }];
const SUPER_ADMIN_NAV = [{ label: "Platform Wallet", href: "/admin/platform-wallet" }];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // The authoritative, DB-verified check — proxy.ts only did a cheap
  // cookie-presence check on the way in.
  const { roles } = await requireAdmin();
  const nav = roles.includes("SUPER_ADMIN") ? [...BASE_NAV, ...SUPER_ADMIN_NAV] : BASE_NAV;

  return (
    <>
      <SkipLink />
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-border bg-background">
          <Container className="flex h-16 items-center justify-between gap-4">
            <Link href="/admin/withdrawals" aria-label="MKTrading admin home" className="shrink-0">
              <Logo />
            </Link>
            <nav aria-label="Admin" className="hidden items-center gap-6 sm:flex">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <LogoutButton />
          </Container>
        </header>
        <main id="main-content" className="flex-1">
          {children}
        </main>
      </div>
    </>
  );
}
