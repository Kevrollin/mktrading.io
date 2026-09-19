"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StepUpAction } from "@/components/admin/step-up-prompt";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/auth/csrf-client";
import { TRADE_DURATIONS_SECONDS } from "@/lib/trading/durations";

export interface InstrumentAdminRow {
  id: string;
  symbol: string;
  name: string;
  category: string;
  isActive: boolean;
  payoutPercent: string;
  allowedDurationsSeconds: number[];
  minStake: string | null;
  maxStake: string | null;
}

function formatDuration(seconds: number): string {
  return seconds < 60 ? `${seconds}s` : `${seconds / 60}m`;
}

async function submitUpdate(id: string, body: Record<string, unknown>): Promise<string | null> {
  const response = await apiFetch(`/api/admin/instruments/${id}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return data.error ?? "Something went wrong.";
}

export function InstrumentForm({ instrument }: { instrument: InstrumentAdminRow }) {
  const router = useRouter();
  const [durations, setDurations] = useState<number[]>(instrument.allowedDurationsSeconds);

  function toggleDuration(seconds: number) {
    setDurations((prev) =>
      prev.includes(seconds) ? prev.filter((s) => s !== seconds) : [...prev, seconds].sort((a, b) => a - b),
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {instrument.symbol} — {instrument.name}
          </h2>
          <p className="text-xs capitalize text-muted-foreground">{instrument.category.replace("-", " ")}</p>
        </div>
        <Badge variant={instrument.isActive ? "positive" : "neutral"}>
          {instrument.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Payout</dt>
          <dd className="text-foreground">{instrument.payoutPercent}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Min stake</dt>
          <dd className="text-foreground">{instrument.minStake ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Max stake</dt>
          <dd className="text-foreground">{instrument.maxStake ?? "—"}</dd>
        </div>
      </dl>

      <StepUpAction
        title={`Update ${instrument.symbol}`}
        confirmLabel="Save changes"
        extraFields={
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Payout %" htmlFor={`payout-${instrument.id}`}>
                <Input id={`payout-${instrument.id}`} name="payoutPercent" defaultValue={instrument.payoutPercent} />
              </Field>
              <Field label="Min stake" htmlFor={`min-${instrument.id}`}>
                <Input id={`min-${instrument.id}`} name="minStake" defaultValue={instrument.minStake ?? ""} />
              </Field>
              <Field label="Max stake" htmlFor={`max-${instrument.id}`}>
                <Input id={`max-${instrument.id}`} name="maxStake" defaultValue={instrument.maxStake ?? ""} />
              </Field>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Allowed durations</span>
              <div className="flex gap-4">
                {TRADE_DURATIONS_SECONDS.map((seconds) => (
                  <label key={seconds} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={durations.includes(seconds)}
                      onChange={() => toggleDuration(seconds)}
                      className="h-4 w-4 rounded border-border text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {formatDuration(seconds)}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={instrument.isActive}
                className="h-4 w-4 rounded border-border text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              Active (tradeable)
            </label>
          </div>
        }
        onSubmit={async (formData) => {
          const error = await submitUpdate(instrument.id, {
            code: formData.get("code"),
            payoutPercent: formData.get("payoutPercent") || undefined,
            minStake: formData.get("minStake") || undefined,
            maxStake: formData.get("maxStake") || undefined,
            allowedDurationsSeconds: durations,
            isActive: formData.get("isActive") === "on",
          });
          if (!error) router.refresh();
          return error;
        }}
      />
    </Card>
  );
}
