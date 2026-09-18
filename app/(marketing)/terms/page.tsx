import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { LegalSection } from "@/components/marketing/legal-section";
import { PageHero } from "@/components/marketing/page-hero";
import { TERMS } from "@/lib/legal-content";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Service",
  description: TERMS.intro[0],
  path: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title={TERMS.title} />
      <Container className="flex flex-col gap-8 py-12">
        <Badge variant="warning" className="self-start">
          {TERMS.status}
        </Badge>
        {TERMS.intro.map((paragraph) => (
          <p key={paragraph} className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            {paragraph}
          </p>
        ))}
        <div className="flex flex-col gap-10">
          {TERMS.sections.map((section) => (
            <LegalSection key={section.heading} section={section} />
          ))}
        </div>
      </Container>
    </>
  );
}
