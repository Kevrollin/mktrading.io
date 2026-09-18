import type { Metadata } from "next";
import { Mail, ShieldQuestion } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ContactMethodCard } from "@/components/marketing/contact-method-card";
import { PageHero } from "@/components/marketing/page-hero";
import { CONTACT_EMAILS } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Contact",
  description: "How to reach the MKTrading team.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Get in touch"
        description="Account-specific support arrives alongside account features. For now, reach us directly at the addresses below."
      />
      <Container className="flex flex-col gap-6 py-12">
        <div className="grid gap-6 sm:grid-cols-2">
          <ContactMethodCard
            icon={Mail}
            label="General support"
            value={CONTACT_EMAILS.support}
            href={`mailto:${CONTACT_EMAILS.support}`}
            description="Questions about the platform, this website, or partnership inquiries."
          />
          <ContactMethodCard
            icon={ShieldQuestion}
            label="Compliance and security"
            value={CONTACT_EMAILS.compliance}
            href={`mailto:${CONTACT_EMAILS.compliance}`}
            description="Compliance questions, responsible-trading concerns, or security reports."
          />
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          We aim to respond within a few business days. This page intentionally has no
          submission form yet — writing to us directly reaches a real inbox rather than a
          placeholder that goes nowhere.
        </p>
      </Container>
    </>
  );
}
