import type { Metadata } from "next";
import { Callout } from "@/components/ui/callout";
import { Container } from "@/components/ui/container";
import { ComplianceNotice } from "@/components/marketing/compliance-notice";
import { FeeScheduleList } from "@/components/marketing/fee-schedule-list";
import { PageHero } from "@/components/marketing/page-hero";
import { FEE_SCHEDULE } from "@/lib/legal-content";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Fees",
  description: "An example of how MKTrading's fee structure will be presented.",
  path: "/fees",
});

export default function FeesPage() {
  return (
    <>
      <PageHero
        eyebrow="Fees"
        title="Example fee structure"
        description="These figures show how fees will be presented — they are not current, live pricing."
      />

      <Container className="flex flex-col gap-6 py-12">
        <Callout variant="warning" title="Example fee structure — placeholder pending compliance review">
          {FEE_SCHEDULE.intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </Callout>

        <FeeScheduleList items={FEE_SCHEDULE.items} />

        <ComplianceNotice>
          <p>
            Final pricing will depend on the payment and blockchain infrastructure integrated for
            each region, and will be published here, in-platform, and in the Terms of Service
            before real-money functionality launches.
          </p>
        </ComplianceNotice>
      </Container>
    </>
  );
}
