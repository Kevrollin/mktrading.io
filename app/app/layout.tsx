import type { ReactNode } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { Container } from "@/components/ui/container";
import { SkipLink } from "@/components/ui/skip-link";
import { Logo } from "@/components/layout/logo";
import { requireUser } from "@/lib/auth/dal";

const NAV = [
  { label: "Overview", href: "/app" },
  { label: "Security", href: "/app/security" },
  { label: "Profile", href: "/app/profile" },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  // The authoritative, DB-verified auth check — proxy.ts only did a
  // cheap cookie-presence check on the way in.
  await requireUser();

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
              {NAV.map((item) => (
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
