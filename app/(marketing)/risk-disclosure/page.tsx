import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { LegalSection } from "@/components/marketing/legal-section";
import { PageHero } from "@/components/marketing/page-hero";
import { RISK_DISCLOSURE } from "@/lib/legal-content";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Risk Disclosure",
  description: RISK_DISCLOSURE.intro[0],
  path: "/risk-disclosure",
});

export default function RiskDisclosurePage() {
  return (
    <>
      <PageHero eyebrow="Legal" title={RISK_DISCLOSURE.title} />
      <Container className="flex flex-col gap-8 py-12">
        <Badge variant="warning" className="self-start">
          {RISK_DISCLOSURE.status}
        </Badge>
        {RISK_DISCLOSURE.intro.map((paragraph) => (
          <p key={paragraph} className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            {paragraph}
          </p>
        ))}
        <div className="flex flex-col gap-10">
          {RISK_DISCLOSURE.sections.map((section) => (
            <LegalSection key={section.heading} section={section} />
          ))}
        </div>
      </Container>
    </>
  );
}
