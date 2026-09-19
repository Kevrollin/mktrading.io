"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/auth/csrf-client";

export interface DepositRow {
  id: string;
  currency: string;
  method: "CRYPTO" | "MOBILE_MONEY";
  status: "PENDING" | "CONFIRMED" | "FAILED" | "CANCELLED";
  requestedAmount: string;
  confirmedAmount: string | null;
  referenceCode: string;
  destinationAddress: string | null;
  rejectionReason: string | null;
  placedAt: string;
}

const POLL_INTERVAL_MS = 2000;

const STATUS_VARIANT: Record<DepositRow["status"], "neutral" | "positive" | "negative" | "warning"> = {
  PENDING: "warning",
  CONFIRMED: "positive",
  FAILED: "negative",
  CANCELLED: "neutral",
};

/** Self-stopping: keeps polling only while a mobile-money deposit is
 * still PENDING (the one status that resolves itself without an admin),
 * directly mirroring components/trading/open-trades-panel.tsx's
 * useEffect/setTimeout/cancelled pattern. */
export function DepositHistory({ initialDeposits }: { initialDeposits: DepositRow[] }) {
  const [deposits, setDeposits] = useState<DepositRow[]>(initialDeposits);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const response = await fetch("/api/deposits");
        if (response.ok && !cancelled) {
          const data = await response.json();
          setDeposits(data.deposits);
          const stillPendingMobileMoney = (data.deposits as DepositRow[]).some(
            (d) => d.status === "PENDING" && d.method === "MOBILE_MONEY",
          );
          if (stillPendingMobileMoney && !cancelled) {
            timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
          }
        }
      } catch {
        // Transient failure — a future action or remount retries.
      }
    }

    const hasPendingMobileMoney = initialDeposits.some(
      (d) => d.status === "PENDING" && d.method === "MOBILE_MONEY",
    );
    if (hasPendingMobileMoney) {
      timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    }

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [initialDeposits]);

  async function handleCancel(id: string) {
    setCancellingId(id);
    try {
      const response = await apiFetch(`/api/deposits/${id}`, { method: "DELETE" });
      if (response.ok) {
        const refreshed = await fetch("/api/deposits").then((r) => r.json());
        setDeposits(refreshed.deposits);
      }
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <Card className="flex flex-col gap-2 p-6">
      <h2 className="text-lg font-semibold text-foreground">Your deposit requests</h2>
      {deposits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No deposit requests yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {deposits.map((deposit) => (
            <div
              key={deposit.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground">
                  {deposit.confirmedAmount ?? deposit.requestedAmount} {deposit.currency} ·{" "}
                  {deposit.method === "CRYPTO" ? "Crypto" : "M-Pesa"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {deposit.referenceCode} — {new Date(deposit.placedAt).toLocaleString()}
                </span>
                {deposit.rejectionReason ? (
                  <span className="text-xs text-negative">{deposit.rejectionReason}</span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[deposit.status]}>{deposit.status}</Badge>
                {deposit.status === "PENDING" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={cancellingId === deposit.id}
                    onClick={() => handleCancel(deposit.id)}
                  >
                    {cancellingId === deposit.id ? "Cancelling..." : "Cancel"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
