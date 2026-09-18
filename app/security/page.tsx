import type { Metadata } from "next";
import { Callout } from "@/components/ui/callout";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { CtaSection } from "@/components/marketing/cta-section";
import { PageHero } from "@/components/marketing/page-hero";
import { SecurityGrid } from "@/components/marketing/security-grid";
import { StepFlow, type Step } from "@/components/marketing/step-flow";
import { SECURITY_ITEMS } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Security",
  description: "How MKTrading is designed to protect accounts, funds, and platform integrity.",
  path: "/security",
});

const APPROVAL_STEPS: Step[] = [
  {
    title: "Request is locked",
    description: "The withdrawal amount is locked against your available balance the moment you submit a request.",
  },
  {
    title: "Independent administrator review",
    description: "Multiple authorized administrators review the request independently, each authenticating separately.",
  },
  {
    title: "Execution only after full approval",
    description: "Funds are only released once every required approval is in place — partial approval never triggers a payout.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow="Security"
        title="Built for financial integrity"
        description="These are MKTrading's architectural commitments. They describe how the platform is designed to work — see the note below on what is live today."
      />

      <Container className="flex flex-col gap-8 py-12">
        <SecurityGrid items={SECURITY_ITEMS} />

        <Callout variant="info" title="What's live today">
          <p>
            This public site currently has no backend, accounts, or funds — it exists to explain
            how the platform is designed. These protections apply once account and trading
            features launch.
          </p>
        </Callout>
      </Container>

      <section className="border-t border-border bg-muted py-16">
        <Container className="flex flex-col gap-8">
          <SectionHeading
            eyebrow="Withdrawals"
            title="How a withdrawal will be authorized"
            subtitle="A simplified view of the multi-administrator approval flow withdrawals are designed to follow."
          />
          <div className="max-w-2xl">
            <StepFlow steps={APPROVAL_STEPS} />
          </div>
        </Container>
      </section>

      <CtaSection
        title="Questions about our security model?"
        subtitle="Reach out through the Contact page — our compliance team will follow up."
      />
    </>
  );
}
