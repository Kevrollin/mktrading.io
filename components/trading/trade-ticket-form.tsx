"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/auth/csrf-client";
import { issuesToFieldErrors } from "@/lib/auth/form-errors";
import type { CurrencyBalance } from "@/lib/ledger/balances";
import { TRADE_DURATIONS_SECONDS } from "@/lib/trading/durations";
import type { InstrumentRow } from "@/lib/trading/instruments-service";

function formatDuration(seconds: number): string {
  return seconds < 60 ? `${seconds}s` : `${seconds / 60}m`;
}

export function TradeTicketForm({
  instrument,
  balances,
  onPlaced,
}: {
  instrument: InstrumentRow | null;
  balances: CurrencyBalance[];
  onPlaced: () => void;
}) {
  const [direction, setDirection] = useState<"RISE" | "FALL">("RISE");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!instrument) {
    return (
      <Card className="flex flex-col gap-2 p-6">
        <p className="text-sm text-muted-foreground">Select an instrument to place a trade.</p>
      </Card>
    );
  }

  // Narrowed to a local const — TS can't carry the null-check above
  // across the closure boundary into handleSubmit below.
  const currentInstrument = instrument;
  const allowedDurations = TRADE_DURATIONS_SECONDS.filter((seconds) =>
    currentInstrument.allowedDurationsSeconds.includes(seconds),
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError(null);
    setSuccess(false);

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      instrumentId: currentInstrument.id,
      currency: data.get("currency"),
      direction,
      durationSeconds: Number(data.get("durationSeconds")),
      stakeAmount: data.get("stakeAmount"),
    };

    try {
      const response = await apiFetch("/api/trading/trades", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setErrors(issuesToFieldErrors(result.issues));
        setFormError(result.error ?? "Something went wrong.");
        return;
      }
      setSuccess(true);
      form.reset();
      setDirection("RISE");
      onPlaced();
    } catch {
      setFormError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold text-foreground">
        Trade {instrument.symbol} — {instrument.name}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={direction === "RISE" ? "primary" : "outline"}
            onClick={() => setDirection("RISE")}
            className="flex-1"
          >
            Rise
          </Button>
          <Button
            type="button"
            variant={direction === "FALL" ? "primary" : "outline"}
            onClick={() => setDirection("FALL")}
            className="flex-1"
          >
            Fall
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency" htmlFor="trade-currency" error={errors.currency}>
            <select
              id="trade-currency"
              name="currency"
              required
              className="flex h-10 w-full rounded-[var(--radius)] border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {balances.map((balance) => (
                <option key={balance.currency} value={balance.currency}>
                  {balance.currency} (available: {balance.available})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Duration" htmlFor="trade-duration" error={errors.durationSeconds}>
            <select
              id="trade-duration"
              name="durationSeconds"
              required
              className="flex h-10 w-full rounded-[var(--radius)] border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {allowedDurations.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {formatDuration(seconds)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Stake"
          htmlFor="trade-stake"
          error={errors.stakeAmount}
          hint={
            instrument.minStake || instrument.maxStake
              ? `Min ${instrument.minStake ?? "0"} · Max ${instrument.maxStake ?? "unlimited"}`
              : undefined
          }
        >
          <Input id="trade-stake" name="stakeAmount" type="text" inputMode="decimal" required />
        </Field>

        <p className="text-xs text-muted-foreground">
          Payout on win: {instrument.payoutPercent}% profit on your stake.
        </p>

        {success ? (
          <Callout variant="success">
            <p>Trade placed. Watch it settle in the open trades list below.</p>
          </Callout>
        ) : null}
        {formError ? (
          <Callout variant="danger">
            <p>{formError}</p>
          </Callout>
        ) : null}

        <Button type="submit" disabled={loading} className="self-start">
          {loading ? "Placing..." : "Place trade"}
        </Button>
      </form>
    </Card>
  );
}
