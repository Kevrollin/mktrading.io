import "server-only";
import { createHmac } from "node:crypto";

interface Harmonic {
  periodMs: number;
  amplitude: number;
  phase: number;
}

interface InstrumentPriceModel {
  basePrice: number;
  harmonics: Harmonic[];
  jitterAmplitude: number;
}

const JITTER_BUCKET_MS = 1000;

/**
 * Base prices match lib/demo-markets.ts for continuity. Harmonic periods
 * are long (10+ minutes) relative to the longest trade duration (300s) so
 * the *secret*, HMAC-keyed jitter term below — not this recoverable trend
 * — dominates any single trade's outcome. The house edge lives entirely
 * in each instrument's payoutPercent, never here: this noise is
 * deliberately zero-mean/symmetric.
 *
 * Never send these parameters, or this file, to a client bundle — see the
 * "server-only" import above and price-engine.test.ts's static guard.
 * A client that could observe or derive them could predict outcomes.
 */
const INSTRUMENT_PRICE_MODELS: Record<string, InstrumentPriceModel> = {
  "pulse-index": {
    basePrice: 128.42,
    harmonics: [
      { periodMs: 11 * 60_000, amplitude: 3.2, phase: 0.4 },
      { periodMs: 23 * 60_000, amplitude: 1.6, phase: 2.1 },
      { periodMs: 47 * 60_000, amplitude: 0.9, phase: 4.7 },
    ],
    jitterAmplitude: 0.6,
  },
  "nova-index": {
    basePrice: 56.35,
    harmonics: [
      { periodMs: 13 * 60_000, amplitude: 1.4, phase: 1.1 },
      { periodMs: 29 * 60_000, amplitude: 0.7, phase: 3.3 },
      { periodMs: 53 * 60_000, amplitude: 0.4, phase: 5.9 },
    ],
    jitterAmplitude: 0.3,
  },
  "tidal-range": {
    basePrice: 211.48,
    harmonics: [
      { periodMs: 17 * 60_000, amplitude: 2.1, phase: 0.9 },
      { periodMs: 31 * 60_000, amplitude: 1.1, phase: 2.6 },
      { periodMs: 61 * 60_000, amplitude: 0.6, phase: 5.2 },
    ],
    jitterAmplitude: 0.35,
  },
  "ember-index": {
    basePrice: 864.75,
    harmonics: [
      { periodMs: 19 * 60_000, amplitude: 9.5, phase: 1.7 },
      { periodMs: 37 * 60_000, amplitude: 5.2, phase: 3.9 },
      { periodMs: 67 * 60_000, amplitude: 2.8, phase: 0.5 },
    ],
    jitterAmplitude: 2.2,
  },
  "quartz-index": {
    basePrice: 1303.2,
    harmonics: [
      { periodMs: 23 * 60_000, amplitude: 14.0, phase: 2.4 },
      { periodMs: 41 * 60_000, amplitude: 7.5, phase: 4.4 },
      { periodMs: 71 * 60_000, amplitude: 3.9, phase: 1.2 },
    ],
    jitterAmplitude: 3.1,
  },
  "drift-index": {
    basePrice: 42.41,
    harmonics: [
      { periodMs: 29 * 60_000, amplitude: 0.55, phase: 0.2 },
      { periodMs: 43 * 60_000, amplitude: 0.3, phase: 2.8 },
      { periodMs: 73 * 60_000, amplitude: 0.15, phase: 5.5 },
    ],
    jitterAmplitude: 0.12,
  },
};

function getPriceEngineSecret(): string {
  const secret = process.env.PRICE_ENGINE_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PRICE_ENGINE_SECRET is required in production.");
    }
    console.warn(
      "[dev] PRICE_ENGINE_SECRET is not set — using an insecure fixed development value. Never use this in production.",
    );
    return "insecure-dev-only-price-engine-secret";
  }
  return secret;
}

/**
 * Deterministic pseudo-random value in [-1, 1] for one (instrument,
 * bucket) pair, derived from a server-only secret via HMAC — never
 * reconstructable by anyone who only observes the public price feed,
 * unlike a plain unkeyed hash. Independent per bucket (not a cumulative
 * random walk), which is what keeps priceAt() O(1) and stateless.
 */
function jitterUnit(instrumentId: string, bucketIndex: number): number {
  const hmac = createHmac("sha256", getPriceEngineSecret());
  hmac.update(`${instrumentId}:${bucketIndex}`);
  const digest = hmac.digest();
  const uint32 = digest.readUInt32BE(0);
  return (uint32 / 0xffffffff) * 2 - 1;
}

export function isKnownInstrument(instrumentId: string): boolean {
  return instrumentId in INSTRUMENT_PRICE_MODELS;
}

/**
 * Pure, deterministic, O(1), stateless function of time — the same
 * (instrumentId, timestampMs) always returns the same price, from any
 * server instance, with no stored tick history and no dependency on a
 * background worker/cron. Settling a trade late still gives the exact
 * price at the exact expiry instant, never an approximation — always
 * call this with the moment that actually matters (e.g. a trade's
 * expiresAt), never with "now" as a stand-in for a past instant.
 */
export function priceAt(instrumentId: string, timestampMs: number): number {
  const model = INSTRUMENT_PRICE_MODELS[instrumentId];
  if (!model) {
    throw new Error(`Unknown instrument: ${instrumentId}`);
  }

  let price = model.basePrice;
  for (const harmonic of model.harmonics) {
    price +=
      harmonic.amplitude * Math.sin((2 * Math.PI * timestampMs) / harmonic.periodMs + harmonic.phase);
  }

  // Bounded, independent-per-bucket jitter, linearly interpolated between
  // the current and next second's anchor so the line has no visible jump
  // at whole-second boundaries.
  const bucketIndex = Math.floor(timestampMs / JITTER_BUCKET_MS);
  const bucketProgress = (timestampMs % JITTER_BUCKET_MS) / JITTER_BUCKET_MS;
  const currentJitter = jitterUnit(instrumentId, bucketIndex);
  const nextJitter = jitterUnit(instrumentId, bucketIndex + 1);
  const interpolatedJitter = currentJitter + (nextJitter - currentJitter) * bucketProgress;
  price += interpolatedJitter * model.jitterAmplitude;

  return price;
}
