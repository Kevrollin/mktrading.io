import type { Metadata } from "next";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { ComplianceNotice } from "@/components/marketing/compliance-notice";
import { PageHero } from "@/components/marketing/page-hero";
import { RiskDisclosureBanner } from "@/components/marketing/risk-disclosure-banner";
import { SecurityGrid } from "@/components/marketing/security-grid";
import { buildMetadata } from "@/lib/seo";
import { Gauge, PauseCircle, Wallet } from "lucide-react";

export const metadata: Metadata = buildMetadata({
  title: "Responsible trading",
  description: "Tools and principles MKTrading is designed around to help you trade responsibly.",
  path: "/responsible-trading",
});

const ROADMAP_ITEMS = [
  {
    icon: Wallet,
    title: "Configurable deposit limits",
    description:
      "Planned support for setting your own daily, weekly, or monthly deposit caps — a roadmap feature, not yet available.",
  },
  {
    icon: Gauge,
    title: "Configurable trading limits",
    description:
      "Planned support for capping stake sizes or trade frequency — a roadmap feature, not yet available.",
  },
  {
    icon: PauseCircle,
    title: "Cooling-off and self-exclusion",
    description:
      "Planned support for temporary breaks or longer self-exclusion periods — a roadmap feature, not yet available.",
  },
];

const FAQS = [
  {
    question: "Can trading lead to losing money?",
    answer:
      "Yes. Short-duration contracts can settle against you, and you can lose your full stake on a given trade. See the Risk Disclosure page for full detail.",
  },
  {
    question: "Does MKTrading offer financial advice?",
    answer:
      "No. MKTrading does not provide personalized investment or trading advice. Decisions are yours, and you should seek independent advice if unsure.",
  },
  {
    question: "What if I think I'm trading more than I should?",
    answer:
      "Reach out through the Contact page. Once account features launch, in-platform limit and self-exclusion tools will be available as well.",
  },
];

export default function ResponsibleTradingPage() {
  return (
    <>
      <PageHero
        eyebrow="Responsible trading"
        title="Trade on your own terms"
        description="Responsible trading starts with understanding the risk. These are the tools we're building to help you stay in control."
      />

      <Container className="flex flex-col gap-10 py-12">
        <RiskDisclosureBanner />

        <div className="flex flex-col gap-6">
          <SectionHeading
            eyebrow="Roadmap"
            title="Tools to help you stay in control"
            subtitle="These controls are part of the platform's design and are not yet available."
          />
          <SecurityGrid items={ROADMAP_ITEMS} />
        </div>

        <div className="flex flex-col gap-4">
          <SectionHeading eyebrow="FAQ" title="Common questions" />
          <Accordion type="single" collapsible className="max-w-2xl">
            {FAQS.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <ComplianceNotice>
          <p>
            Jurisdiction-specific self-exclusion mechanics, mandatory limits, and support
            referral requirements will be added here following legal review for each market
            MKTrading serves.
          </p>
        </ComplianceNotice>

        <p className="text-sm text-muted-foreground">
          Need to talk to someone? Visit the{" "}
          <Link href="/contact" className="text-accent underline-offset-4 hover:underline">
            Contact page
          </Link>
          .
        </p>
      </Container>
    </>
  );
}
