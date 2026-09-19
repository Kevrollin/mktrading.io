// The global fixed set of trade durations. An instrument's own
// allowedDurationsSeconds is always a subset of this.
export const TRADE_DURATIONS_SECONDS = [30, 60, 300] as const;
export type TradeDurationSeconds = (typeof TRADE_DURATIONS_SECONDS)[number];

export function isValidDuration(seconds: number): seconds is TradeDurationSeconds {
  return (TRADE_DURATIONS_SECONDS as readonly number[]).includes(seconds);
}
