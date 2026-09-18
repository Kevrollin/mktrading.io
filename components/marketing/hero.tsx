import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { HeroMarketVisual } from "@/components/marketing/hero-market-visual";
import { REGISTER_LINK } from "@/lib/constants";

export function Hero() {
  return (
    <section className="border-b border-border bg-muted">
      <Container className="grid gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:items-center lg:py-28">
        <div className="flex flex-col gap-6">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Trade with clarity.
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
            MKTrading is a modern trading platform built around transparent pricing, clear risk
            information, and a focused trading experience.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={REGISTER_LINK.href}>{REGISTER_LINK.label}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/markets">Explore markets</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Trading involves risk of loss. 18+. See our{" "}
            <Link
              href="/risk-disclosure"
              className="underline underline-offset-4 hover:text-foreground"
            >
              risk disclosure
            </Link>
            .
          </p>
        </div>
        <HeroMarketVisual />
      </Container>
    </section>
  );
}
