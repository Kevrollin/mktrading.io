import { ComplianceNotice } from "@/components/marketing/compliance-notice";
import type { LegalSectionData } from "@/lib/legal-content";

export function LegalSection({ section }: { section: LegalSectionData }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold text-foreground">{section.heading}</h2>
      {section.isCompliancePlaceholder ? (
        <ComplianceNotice>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed">
              {paragraph}
            </p>
          ))}
        </ComplianceNotice>
      ) : (
        section.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-base leading-relaxed text-muted-foreground">
            {paragraph}
          </p>
        ))
      )}
    </section>
  );
}
