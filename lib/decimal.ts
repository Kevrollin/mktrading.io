/** Exact decimal-string comparison via BigInt — never Number() — for
 * comparing money-adjacent values (e.g. a stake against a min/max bound)
 * without floating-point precision loss. */
function toScaledBigInt(value: string, scale: number): bigint {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, frac = ""] = unsigned.split(".");
  const paddedFrac = (frac + "0".repeat(scale)).slice(0, scale);
  const magnitude = BigInt(whole || "0") * BigInt(10) ** BigInt(scale) + BigInt(paddedFrac || "0");
  return negative ? BigInt(-1) * magnitude : magnitude;
}

/** Returns -1 if a < b, 0 if a === b, 1 if a > b. */
export function compareDecimalStrings(a: string, b: string): number {
  const scale = 18;
  const aScaled = toScaledBigInt(a, scale);
  const bScaled = toScaledBigInt(b, scale);
  if (aScaled < bScaled) return -1;
  if (aScaled > bScaled) return 1;
  return 0;
}
