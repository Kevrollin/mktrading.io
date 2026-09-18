import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { REGISTER_LINK } from "@/lib/constants";

export function CtaSection({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <section className="border-t border-border bg-muted">
      <Container className="flex flex-col items-center gap-4 py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">{subtitle}</p>
        ) : null}
        <Button asChild size="lg" className="mt-2">
          <Link href={REGISTER_LINK.href}>{REGISTER_LINK.label}</Link>
        </Button>
        <p className="text-xs text-muted-foreground">Trading involves risk of loss.</p>
      </Container>
    </section>
  );
}
