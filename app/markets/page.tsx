import type { Metadata } from "next";
import { Callout } from "@/components/ui/callout";
import { Container } from "@/components/ui/container";
import { DemoDataBadge } from "@/components/marketing/demo-data-badge";
import { MarketExplorer } from "@/components/marketing/market-explorer";
import { PageHero } from "@/components/marketing/page-hero";
import { DEMO_MARKETS } from "@/lib/demo-markets";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Markets",
  description: "Browse the sample instruments available on MKTrading.",
  path: "/markets",
});

export default function MarketsPage() {
  return (
    <>
      <PageHero
        eyebrow="Markets"
        title="Explore MKTrading's instruments"
        description="A browsable preview of the instrument categories MKTrading is built to support."
      />
      <Container className="flex flex-col gap-6 py-12">
        <div className="flex justify-end">
          <DemoDataBadge />
        </div>
        <MarketExplorer markets={DEMO_MARKETS} />
        <Callout variant="info" title="Live trading isn't available yet">
          <p>
            These instruments illustrate how markets will be presented. Account registration and
            live trading launch in a later milestone.
          </p>
        </Callout>
      </Container>
    </>
  );
}
