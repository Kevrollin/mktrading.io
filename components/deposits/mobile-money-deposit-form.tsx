"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/auth/csrf-client";
import { issuesToFieldErrors } from "@/lib/auth/form-errors";

export function MobileMoneyDepositForm({ defaultPhone }: { defaultPhone: string }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError(null);
    setReferenceCode(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      requestedAmount: data.get("requestedAmount"),
      phone: data.get("phone"),
    };

    try {
      const response = await apiFetch("/api/deposits/mobile-money", {
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
      setReferenceCode(body.deposit.referenceCode);
    } catch {
      setFormError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold text-foreground">Mobile money deposit (M-Pesa)</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (KES)" htmlFor="mpesa-amount" error={errors.requestedAmount}>
            <Input id="mpesa-amount" name="requestedAmount" type="text" inputMode="decimal" required />
          </Field>
          <Field label="Phone number" htmlFor="mpesa-phone" error={errors.phone}>
            <Input
              id="mpesa-phone"
              name="phone"
              type="tel"
              defaultValue={defaultPhone}
              required
              minLength={9}
            />
          </Field>
        </div>

        {referenceCode ? (
          <Callout variant="success">
            <p>
              STK push sent (simulated) — check your phone. Reference code:{" "}
              <span className="font-mono font-semibold">{referenceCode}</span>
            </p>
          </Callout>
        ) : null}
        {formError ? (
          <Callout variant="danger">
            <p>{formError}</p>
          </Callout>
        ) : null}

        <Button type="submit" disabled={loading} className="self-start">
          {loading ? "Sending..." : "Deposit via M-Pesa"}
        </Button>
      </form>
    </Card>
  );
}
