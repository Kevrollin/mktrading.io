import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { LegalSection } from "@/components/marketing/legal-section";
import { PageHero } from "@/components/marketing/page-hero";
import { PRIVACY } from "@/lib/legal-content";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description: PRIVACY.intro[0],
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title={PRIVACY.title} />
      <Container className="flex flex-col gap-8 py-12">
        <Badge variant="warning" className="self-start">
          {PRIVACY.status}
        </Badge>
        {PRIVACY.intro.map((paragraph) => (
          <p key={paragraph} className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            {paragraph}
          </p>
        ))}
        <div className="flex flex-col gap-10">
          {PRIVACY.sections.map((section) => (
            <LegalSection key={section.heading} section={section} />
          ))}
        </div>
      </Container>
    </>
  );
}
