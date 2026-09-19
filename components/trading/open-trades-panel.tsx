"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { InstrumentRow } from "@/lib/trading/instruments-service";

export interface TradeRow {
  id: string;
  instrumentId: string;
  direction: "RISE" | "FALL";
  stakeAmount: string;
  currency: string;
  payoutPercent: string;
  status: "OPEN" | "WON" | "LOST" | "REFUNDED";
  placedAt: string;
  expiresAt: string;
  entryPrice: string;
  settlementPrice: string | null;
  refundReason: string | null;
}

const POLL_INTERVAL_MS = 1500;

const STATUS_VARIANT: Record<TradeRow["status"], "neutral" | "positive" | "negative" | "warning"> = {
  OPEN: "warning",
  WON: "positive",
  LOST: "negative",
  REFUNDED: "neutral",
};

function useCountdown(expiresAt: string): number {
  const [remainingMs, setRemainingMs] = useState(() => new Date(expiresAt).getTime() - Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(new Date(expiresAt).getTime() - Date.now());
    }, 250);
    return () => clearInterval(interval);
  }, [expiresAt]);
  return remainingMs;
}

function TradeCountdown({ expiresAt }: { expiresAt: string }) {
  const remainingMs = useCountdown(expiresAt);
  if (remainingMs <= 0) {
    return <span className="text-xs text-warning">Settling…</span>;
  }
  return <span className="text-xs text-muted-foreground">{Math.ceil(remainingMs / 1000)}s left</span>;
}

/** Self-stopping: keeps polling only while at least one trade is OPEN.
 * `refreshSignal` changing (bumped whenever a new trade is placed)
 * restarts the effect and resumes polling. */
export function OpenTradesPanel({
  instruments,
  refreshSignal,
}: {
  instruments: InstrumentRow[];
  refreshSignal: number;
}) {
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const instrumentById = new Map(instruments.map((instrument) => [instrument.id, instrument]));

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const response = await fetch("/api/trading/trades");
        if (response.ok && !cancelled) {
          const data = await response.json();
          setTrades(data.trades);
          setLoaded(true);
          const stillOpen = (data.trades as TradeRow[]).some((trade) => trade.status === "OPEN");
          if (stillOpen && !cancelled) {
            timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
          }
        }
      } catch {
        // Transient failure — a future refreshSignal bump or remount retries.
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [refreshSignal]);

  return (
    <Card className="flex flex-col gap-2 p-6">
      <h2 className="text-lg font-semibold text-foreground">Your trades</h2>
      {!loaded ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : trades.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trades yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {trades.map((trade) => {
            const instrument = instrumentById.get(trade.instrumentId);
            return (
              <div
                key={trade.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-foreground">
                    {instrument?.symbol ?? trade.instrumentId} · {trade.direction === "RISE" ? "Rise" : "Fall"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {trade.stakeAmount} {trade.currency} at {Number(trade.entryPrice).toFixed(2)}
                  </span>
                  {trade.refundReason ? (
                    <span className="text-xs text-muted-foreground">{trade.refundReason}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {trade.status === "OPEN" ? <TradeCountdown expiresAt={trade.expiresAt} /> : null}
                  <Badge variant={STATUS_VARIANT[trade.status]}>{trade.status}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
