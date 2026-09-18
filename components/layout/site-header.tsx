import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { DesktopNav } from "@/components/layout/desktop-nav";
import { Logo } from "@/components/layout/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { LOGIN_LINK, REGISTER_LINK } from "@/lib/constants";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="MKTrading home" className="shrink-0">
          <Logo />
        </Link>

        <DesktopNav />

        <div className="flex items-center gap-2">
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
          <Button asChild variant="ghost" size="md" className="hidden lg:inline-flex">
            <Link href={LOGIN_LINK.href}>{LOGIN_LINK.label}</Link>
          </Button>
          <Button asChild variant="primary" size="md" className="hidden lg:inline-flex">
            <Link href={REGISTER_LINK.href}>{REGISTER_LINK.label}</Link>
          </Button>
          <div className="lg:hidden">
            <MobileNav />
          </div>
        </div>
      </Container>
    </header>
  );
}
