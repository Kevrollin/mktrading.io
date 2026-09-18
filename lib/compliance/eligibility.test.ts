import { afterEach, describe, expect, it } from "vitest";
import { isCountryEligible } from "@/lib/compliance/eligible-countries";
import { isOldEnough } from "@/lib/compliance/age";

describe("isOldEnough", () => {
  it("passes when exactly 18 today", () => {
    const now = new Date("2026-06-15T00:00:00Z");
    const dob = new Date("2008-06-15T00:00:00Z");
    expect(isOldEnough(dob, now)).toBe(true);
  });

  it("fails when one day short of 18", () => {
    const now = new Date("2026-06-15T00:00:00Z");
    const dob = new Date("2008-06-16T00:00:00Z");
    expect(isOldEnough(dob, now)).toBe(false);
  });

  it("handles a Feb 29 birthdate in a non-leap year: not yet 18 on Feb 28", () => {
    const now = new Date("2026-02-28T00:00:00Z");
    const dob = new Date("2008-02-29T00:00:00Z");
    expect(isOldEnough(dob, now)).toBe(false);
  });

  it("handles a Feb 29 birthdate in a non-leap year: 18 by Mar 1", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    const dob = new Date("2008-02-29T00:00:00Z");
    expect(isOldEnough(dob, now)).toBe(true);
  });
});

describe("isCountryEligible", () => {
  const originalValue = process.env.RESTRICTED_COUNTRIES;
  afterEach(() => {
    process.env.RESTRICTED_COUNTRIES = originalValue;
  });

  it("allows a country not in the restricted list", () => {
    process.env.RESTRICTED_COUNTRIES = "";
    expect(isCountryEligible("KE")).toBe(true);
  });

  it("denies a country explicitly in the restricted list", () => {
    process.env.RESTRICTED_COUNTRIES = "US,KP";
    expect(isCountryEligible("KP")).toBe(false);
  });

  it("is case-insensitive on both sides", () => {
    process.env.RESTRICTED_COUNTRIES = "us,kp";
    expect(isCountryEligible("KP")).toBe(false);
    expect(isCountryEligible("ke")).toBe(true);
  });
});
