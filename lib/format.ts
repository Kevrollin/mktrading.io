const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// changePercent is stored as a percentage value (e.g. 1.24 means +1.24%).
const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

export function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

export function formatChangePercent(value: number): string {
  return percentFormatter.format(value / 100);
}
