import type { ReactNode } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { Container } from "@/components/ui/container";
import { SkipLink } from "@/components/ui/skip-link";
import { Logo } from "@/components/layout/logo";
import { requireUser } from "@/lib/auth/dal";
import { getCurrentUserRoles, isAdminRole } from "@/lib/auth/rbac";

const BASE_NAV = [
  { label: "Overview", href: "/app" },
  { label: "Trade", href: "/app/trade" },
  { label: "Wallet", href: "/app/wallet" },
  { label: "Security", href: "/app/security" },
  { label: "Profile", href: "/app/profile" },
];
const ADMIN_NAV = [{ label: "Admin", href: "/admin/withdrawals" }];

export default async function AppLayout({ children }: { children: ReactNode }) {
  // The authoritative, DB-verified auth check — proxy.ts only did a
  // cheap cookie-presence check on the way in.
  const user = await requireUser();
  // Login always lands here regardless of role — an admin account has no
  // other way to discover the separate /admin/* section without this.
  const roles = await getCurrentUserRoles(user.id);
  const nav = isAdminRole(roles) ? [...BASE_NAV, ...ADMIN_NAV] : BASE_NAV;

  return (
    <>
      <SkipLink />
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-border bg-background">
          <Container className="flex h-16 items-center justify-between gap-4">
            <Link href="/app" aria-label="MKTrading account home" className="shrink-0">
              <Logo />
            </Link>
            <nav aria-label="Account" className="hidden items-center gap-6 sm:flex">
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
