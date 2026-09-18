import { DemoDataBadge } from "@/components/marketing/demo-data-badge";
import { MarketCard } from "@/components/marketing/market-card";
import { StatTile } from "@/components/marketing/stat-tile";
import { DEMO_MARKETS } from "@/lib/demo-markets";

export function HeroMarketVisual() {
  const featured = DEMO_MARKETS[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <DemoDataBadge />
      </div>
      <MarketCard market={featured} />
      <div className="grid grid-cols-2 gap-4">
        <StatTile label="Sample instruments" value={String(DEMO_MARKETS.length)} />
        <StatTile label="Example expiry" value="5 min" />
      </div>
    </div>
  );
}
