import type { Market } from "@/types/market";

/**
 * Sample instruments for the public site only — fully original names, no real
 * market data. Values are hardcoded literals (not generated at render time)
 * so server and client always agree; never derive this from Math.random() or
 * Date.now(), which would cause a hydration mismatch.
 *
 * The real trading engine's `instruments` table (lib/db/schema/instruments.ts,
 * seeded in supabase/seed.sql) reuses these same ids/symbols/names/categories
 * for continuity — the two are independent sources of truth, not synced.
 * Editing one never updates the other.
 */
export const DEMO_MARKETS: Market[] = [
  {
    id: "pulse-index",
    symbol: "PULS",
    name: "Pulse Index",
    category: "rapid",
    description:
      "A fast-moving sample instrument used to illustrate short-duration contracts.",
    price: 128.42,
    changePercent: 3.48,
    status: "open",
    spark: [
      124.1, 124.8, 124.3, 125.6, 126.1, 125.4, 126.9, 127.5, 126.8, 127.9,
      128.6, 128.1, 128.9, 128.42,
    ],
  },
  {
    id: "nova-index",
    symbol: "NOVA",
    name: "Nova Index",
    category: "rapid",
    description: "An original sample instrument demonstrating rapid price movement.",
    price: 56.35,
    changePercent: -3.18,
    status: "open",
    spark: [
      58.2, 57.9, 58.4, 57.6, 57.1, 57.8, 57.3, 56.9, 57.2, 56.6, 56.9, 56.4,
      56.7, 56.35,
    ],
  },
  {
    id: "tidal-range",
    symbol: "TIDE",
    name: "Tidal Range",
    category: "range-bound",
    description:
      "A sample range-bound instrument used to illustrate boundary-style contracts.",
    price: 211.48,
    changePercent: 0.51,
    status: "open",
    spark: [
      210.4, 211.1, 210.8, 211.4, 210.9, 211.6, 211.2, 211.5, 211.1, 211.7,
      211.3, 211.55, 211.35, 211.48,
    ],
  },
  {
    id: "ember-index",
    symbol: "EMBR",
    name: "Ember Index",
    category: "standard",
    description:
      "An example standard-tempo instrument for illustrating typical contract pacing.",
    price: 864.75,
    changePercent: 2.34,
    status: "open",
    spark: [
      845.0, 848.2, 846.5, 851.3, 849.8, 854.6, 852.9, 857.4, 855.7, 860.2,
      858.5, 862.9, 861.3, 864.75,
    ],
  },
  {
    id: "quartz-index",
    symbol: "QRTZ",
    name: "Quartz Index",
    category: "standard",
    description:
      "A sample standard-tempo instrument, shown here in a closed trading state.",
    price: 1303.2,
    changePercent: -1.46,
    status: "closed",
    spark: [
      1322.5, 1319.8, 1324.1, 1317.6, 1320.9, 1315.4, 1318.7, 1312.3, 1314.8,
      1309.6, 1311.9, 1307.4, 1305.8, 1303.2,
    ],
  },
  {
    id: "drift-index",
    symbol: "DRFT",
    name: "Drift Index",
    category: "range-bound",
    description:
      "A sample range-bound instrument illustrating narrow, contained price movement.",
    price: 42.41,
    changePercent: 0.62,
    status: "open",
    spark: [
      42.15, 42.28, 42.1, 42.31, 42.19, 42.34, 42.22, 42.36, 42.25, 42.37,
      42.28, 42.39, 42.3, 42.41,
    ],
  },
];
