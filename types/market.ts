export type MarketCategory = "rapid" | "standard" | "range-bound";

export type MarketStatus = "open" | "closed";

export interface Market {
  id: string;
  symbol: string;
  name: string;
  category: MarketCategory;
  description: string;
  price: number;
  changePercent: number;
  status: MarketStatus;
  /** Deterministic sample series for the sparkline — index 0 is oldest. */
  spark: number[];
}
