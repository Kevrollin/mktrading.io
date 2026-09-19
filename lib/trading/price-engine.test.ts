import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { priceAt } from "@/lib/trading/price-engine";

const INSTRUMENT_IDS = ["pulse-index", "nova-index", "tidal-range", "ember-index", "quartz-index", "drift-index"];

describe("priceAt", () => {
  it("is deterministic — identical inputs return bit-identical output", () => {
    const timestampMs = 1_780_000_000_000;
    for (const instrumentId of INSTRUMENT_IDS) {
      expect(priceAt(instrumentId, timestampMs)).toBe(priceAt(instrumentId, timestampMs));
    }
  });

  it("gives independent results per instrument at the same timestamp", () => {
    const timestampMs = Date.now();
    const prices = INSTRUMENT_IDS.map((id) => priceAt(id, timestampMs));
    expect(new Set(prices).size).toBe(prices.length);
  });

  it("stays finite and positive across a wide sweep of timestamps, including far past/future", () => {
    const now = Date.now();
    const offsets = [
      -10 * 365 * 24 * 60 * 60_000, // 10 years in the past
      -60_000,
      0,
      1,
      60_000,
      10 * 365 * 24 * 60 * 60_000, // 10 years in the future
    ];
    for (const instrumentId of INSTRUMENT_IDS) {
      for (const offset of offsets) {
        const price = priceAt(instrumentId, now + offset);
        expect(Number.isFinite(price)).toBe(true);
        expect(price).toBeGreaterThan(0);
      }
    }
  });

  it("throws for an unknown instrument rather than silently returning a price", () => {
    expect(() => priceAt("not-a-real-instrument", Date.now())).toThrow();
  });

  it("is continuous — no large jump across a 1ms step, including across second boundaries", () => {
    const secondBoundaryMs = Math.floor(Date.now() / 1000) * 1000;
    const sampleTimestamps = [secondBoundaryMs - 1, secondBoundaryMs, secondBoundaryMs + 1, secondBoundaryMs + 500];
    for (const instrumentId of INSTRUMENT_IDS) {
      for (const t of sampleTimestamps) {
        const a = priceAt(instrumentId, t);
        const b = priceAt(instrumentId, t + 1);
        // A single millisecond can never move price by more than a small
        // fraction of the instrument's own jitter amplitude — this
        // catches an accidental discontinuity in the bucket-interpolation
        // logic, not normal instrument-to-instrument volatility
        // differences (hence a generous, instrument-agnostic bound).
        expect(Math.abs(b - a)).toBeLessThan(1);
      }
    }
  });

  it("never reaches the client — source starts with the server-only guard", () => {
    const source = readFileSync(path.join(process.cwd(), "lib", "trading", "price-engine.ts"), "utf8");
    expect(source.trimStart().startsWith('import "server-only"')).toBe(true);
  });
});
