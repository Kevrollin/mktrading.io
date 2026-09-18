import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { ContractExplainer } from "@/components/marketing/contract-explainer";
import { CtaSection } from "@/components/marketing/cta-section";
import { DemoDataBadge } from "@/components/marketing/demo-data-badge";
import { Hero } from "@/components/marketing/hero";
import { MarketGrid } from "@/components/marketing/market-grid";
import { RiskDisclosureBanner } from "@/components/marketing/risk-disclosure-banner";
import { SecurityGrid } from "@/components/marketing/security-grid";
import { StatTile } from "@/components/marketing/stat-tile";
import { StepFlow, type Step } from "@/components/marketing/step-flow";
import { DEMO_MARKETS } from "@/lib/demo-markets";
import { SECURITY_ITEMS } from "@/lib/constants";

const CONDENSED_STEPS: Step[] = [
  {
    title: "Create and verify your account",
    description: "Register and complete identity verification before funding or withdrawing.",
  },
  {
    title: "Fund your account",
    description: "Deposit using mobile money or cryptocurrency once payment providers are live.",
  },
  {
    title: "Trade with full visibility",
    description: "Review potential payout and maximum loss before every trade is confirmed.",
  },
];

export default function Home() {
  return (
    <>
      <Hero />

      <section className="py-16">
        <Container className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Design commitment" value="Multi-approval treasury" hint="Not yet live" />
          <StatTile label="Design commitment" value="KYC-verified accounts" hint="Not yet live" />
          <StatTile label="Design commitment" value="Continuous monitoring" hint="Not yet live" />
        </Container>
      </section>

      <section className="py-16">
        <Container className="flex flex-col gap-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Markets"
              title="Live markets"
              subtitle="A preview of the instruments available on MKTrading."
            />
            <DemoDataBadge />
          </div>
          <MarketGrid markets={DEMO_MARKETS.slice(0, 4)} />
          <Button asChild variant="outline" size="md" className="self-start">
            <Link href="/markets">View all markets</Link>
          </Button>
        </Container>
      </section>

      <section className="border-t border-border bg-muted py-16">
        <Container className="flex flex-col gap-8">
          <SectionHeading
            eyebrow="Trading experience"
            title="Know your outcome before you trade"
            subtitle="Every contract shows its stake, potential payout, and maximum loss up front."
          />
          <ContractExplainer />
        </Container>
      </section>

      <section className="py-16">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <SectionHeading
            eyebrow="How it works"
            title="From account to settlement"
            subtitle="A focused path from registration to your first trade."
          />
          <div className="flex flex-col gap-6">
            <StepFlow steps={CONDENSED_STEPS} />
            <Link
              href="/how-it-works"
              className="self-start text-sm font-medium text-accent underline-offset-4 hover:underline"
            >
              See the full walkthrough →
            </Link>
          </div>
        </Container>
      </section>

      <section className="border-t border-border bg-muted py-16">
        <Container className="flex flex-col gap-8">
          <SectionHeading
            eyebrow="Security"
            title="Built for financial integrity"
            subtitle="These are the platform's design commitments — see the Security page for details."
          />
          <SecurityGrid items={SECURITY_ITEMS} />
        </Container>
      </section>

      <section className="py-16">
        <Container>
          <RiskDisclosureBanner />
        </Container>
      </section>

      <CtaSection
        title="Create your MKTrading account"
        subtitle="Registration and trading are launching in the next milestone."
      />
    </>
  );
}
