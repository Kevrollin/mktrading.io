import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MovementIndicator } from "@/components/marketing/movement-indicator";
import { Sparkline } from "@/components/marketing/sparkline";
import { formatPrice } from "@/lib/format";
import type { Market } from "@/types/market";

// Not a link: there is no per-market detail page in this milestone (that
// arrives with the trading terminal), so this stays a presentational card
// rather than a click-through to somewhere that doesn't exist yet.
export function MarketCard({ market }: { market: Market }) {
  return (
    <Card className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{market.symbol}</p>
          <p className="text-base font-semibold text-foreground">{market.name}</p>
        </div>
        <Badge variant={market.status === "open" ? "positive" : "neutral"}>
          {market.status === "open" ? "Open" : "Closed"}
        </Badge>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {formatPrice(market.price)}
          </p>
          <MovementIndicator changePercent={market.changePercent} className="mt-1" />
        </div>
        <Sparkline data={market.spark} width={88} height={36} />
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{market.description}</p>
    </Card>
  );
}
