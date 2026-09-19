"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/auth/csrf-client";
import { issuesToFieldErrors } from "@/lib/auth/form-errors";

export interface CryptoWalletOption {
  currency: string;
}

interface CryptoDepositResult {
  destinationAddress: string;
  referenceCode: string;
  currency: string;
}

export function CryptoDepositForm({ wallets }: { wallets: CryptoWalletOption[] }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<CryptoDepositResult | null>(null);
  const [loading, setLoading] = useState(false);

  if (wallets.length === 0) {
    return (
      <Card className="flex flex-col gap-2 p-6">
        <h2 className="text-lg font-semibold text-foreground">Crypto deposit</h2>
        <p className="text-sm text-muted-foreground">
          No crypto deposit addresses are configured yet — check back later.
        </p>
      </Card>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError(null);
    setResult(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      currency: data.get("currency"),
      requestedAmount: data.get("requestedAmount"),
    };

    try {
      const response = await apiFetch("/api/deposits/crypto", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        setErrors(issuesToFieldErrors(body.issues));
        setFormError(body.error ?? "Something went wrong.");
        return;
      }
      setResult({
        destinationAddress: body.deposit.destinationAddress,
        referenceCode: body.deposit.referenceCode,
        currency: body.deposit.currency,
      });
      form.reset();
    } catch {
      setFormError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold text-foreground">Crypto deposit</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency" htmlFor="crypto-currency" error={errors.currency}>
            <select
              id="crypto-currency"
              name="currency"
              required
              className="flex h-10 w-full rounded-[var(--radius)] border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {wallets.map((wallet) => (
                <option key={wallet.currency} value={wallet.currency}>
                  {wallet.currency}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount you intend to send" htmlFor="crypto-amount" error={errors.requestedAmount}>
            <Input id="crypto-amount" name="requestedAmount" type="text" inputMode="decimal" required />
          </Field>
        </div>

        {result ? (
          <Callout variant="success" title="Send exactly this, quoting the reference code">
            <p className="break-all font-mono text-sm">{result.destinationAddress}</p>
            <p>
              Reference code: <span className="font-mono font-semibold">{result.referenceCode}</span> — an
              admin will manually confirm this deposit once they see it arrive.
            </p>
          </Callout>
        ) : null}
        {formError ? (
          <Callout variant="danger">
            <p>{formError}</p>
          </Callout>
        ) : null}

        <Button type="submit" disabled={loading} className="self-start">
          {loading ? "Requesting..." : "Get deposit address"}
        </Button>
      </form>
    </Card>
  );
}
