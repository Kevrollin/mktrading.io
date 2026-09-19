"use client";

import { useEffect, useState } from "react";

interface PriceSample {
  timestampMs: number;
  price: number;
}

const POLL_INTERVAL_MS = 1000;
const MAX_SAMPLES = 60;

/**
 * Polls the server for the current price and draws from the array of
 * *observed* samples it accumulates — it never computes a price itself.
 * The price engine (lib/trading/price-engine.ts) is server-only on
 * purpose: this chart must show exactly what will be used to settle a
 * trade, without the client ever knowing the formula that produces it.
 * Same hand-rolled inline-SVG polyline technique as
 * components/marketing/sparkline.tsx — no charting dependency.
 *
 * The caller must render this with `key={instrumentId}` so switching
 * instruments remounts it (resetting accumulated samples) instead of
 * reusing state across instruments — the idiomatic React way to reset
 * local state on a prop change, rather than a setState call inside the
 * effect body.
 */
export function PriceChart({ instrumentId }: { instrumentId: string }) {
  const [samples, setSamples] = useState<PriceSample[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/trading/instruments/${instrumentId}/price`);
        if (!response.ok || cancelled) return;
        const data = await response.json();
        if (cancelled) return;
        setSamples((prev) =>
          [...prev, { timestampMs: data.timestampMs, price: data.price }].slice(-MAX_SAMPLES),
        );
      } catch {
        // Transient poll failure — the next tick will retry.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [instrumentId]);

  if (samples.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-[var(--radius)] border border-border bg-card text-sm text-muted-foreground">
        Loading price…
      </div>
    );
  }

  const width = 600;
  const height = 192;
  const padding = 12;
  const prices = samples.map((sample) => sample.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = samples
    .map((sample, index) => {
      const x = (index / (samples.length - 1)) * width;
      const y = height - padding - ((sample.price - min) / range) * (height - padding * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const latest = samples[samples.length - 1]!;
  const first = samples[0]!;
  const trend = latest.price > first.price ? "up" : latest.price < first.price ? "down" : "flat";
  const strokeColor =
    trend === "up" ? "var(--positive)" : trend === "down" ? "var(--negative)" : "var(--muted-foreground)";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-semibold tabular-nums text-foreground">{latest.price.toFixed(2)}</span>
        <span className="text-xs text-muted-foreground">live</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`Live price chart, currently ${latest.price.toFixed(2)}`}
        className="rounded-[var(--radius)] border border-border bg-card"
      >
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
