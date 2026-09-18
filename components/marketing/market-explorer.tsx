"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketGrid } from "@/components/marketing/market-grid";
import type { Market, MarketCategory } from "@/types/market";

const CATEGORIES: { value: "all" | MarketCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "rapid", label: "Rapid" },
  { value: "standard", label: "Standard" },
  { value: "range-bound", label: "Range-bound" },
];

export function MarketExplorer({ markets }: { markets: Market[] }) {
  return (
    <Tabs defaultValue="all">
      <TabsList>
        {CATEGORIES.map((category) => (
          <TabsTrigger key={category.value} value={category.value}>
            {category.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {CATEGORIES.map((category) => (
        <TabsContent key={category.value} value={category.value}>
          <MarketGrid
            markets={
              category.value === "all"
                ? markets
                : markets.filter((market) => market.category === category.value)
            }
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
