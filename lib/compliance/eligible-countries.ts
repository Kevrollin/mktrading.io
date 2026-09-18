// Default: allow every country. Set RESTRICTED_COUNTRIES (comma-separated
// ISO 3166-1 alpha-2 codes) to deny specific ones once real jurisdiction
// eligibility rules are defined. Becomes a proper DB-backed admin setting
// once an admin settings UI exists — a plain env constant is deliberately
// enough for now.
// Read live (not cached at module-load time) so it's actually testable
// and so a process doesn't need restarting to pick up a change.
function getRestrictedCountries(): Set<string> {
  return new Set(
    (process.env.RESTRICTED_COUNTRIES ?? "")
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean),
  );
}

export function isCountryEligible(countryCode: string): boolean {
  return !getRestrictedCountries().has(countryCode.toUpperCase());
}
