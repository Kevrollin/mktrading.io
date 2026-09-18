import { MarketCard } from "@/components/marketing/market-card";
import type { Market } from "@/types/market";

export function MarketGrid({ markets }: { markets: Market[] }) {
  if (markets.length === 0) {
    return (
      <p className="rounded-[var(--radius)] border border-border bg-muted p-6 text-center text-sm text-muted-foreground">
        No sample markets in this category yet.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {markets.map((market) => (
        <MarketCard key={market.id} market={market} />
      ))}
    </div>
  );
}
