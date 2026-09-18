"use client";

import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const EXAMPLE = {
  market: "Pulse Index",
  stake: "$25.00",
  payout: "$46.50",
  maxLoss: "$25.00",
  expiry: "5 minutes",
};

export function ContractExplainer() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">
          Illustrative example — not a live trade
        </p>
        <Badge variant="accent">{EXAMPLE.market}</Badge>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div>
          <dt className="text-sm text-muted-foreground">Stake</dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">{EXAMPLE.stake}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Potential payout</dt>
          <dd className="text-lg font-semibold tabular-nums text-positive">{EXAMPLE.payout}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Maximum loss</dt>
          <dd className="text-lg font-semibold tabular-nums text-negative">{EXAMPLE.maxLoss}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-sm text-muted-foreground">
            Expiry
            <Tooltip>
              <TooltipTrigger aria-label="What is expiry?" className="text-muted-foreground hover:text-foreground">
                <Info aria-hidden="true" className="h-3.5 w-3.5" />
              </TooltipTrigger>
              <TooltipContent>
                The moment a contract settles and its outcome is determined.
              </TooltipContent>
            </Tooltip>
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">{EXAMPLE.expiry}</dd>
        </div>
      </dl>

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        Potential payout and maximum loss are always shown in full before a trade is confirmed.
        If this example contract settles against the trade, the maximum loss shown is what would
        actually be lost.
      </p>
    </Card>
  );
}
