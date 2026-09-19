"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/auth/csrf-client";
import { issuesToFieldErrors } from "@/lib/auth/form-errors";
import type { CurrencyBalance } from "@/lib/ledger/balances";

export interface WithdrawalRow {
  id: string;
  currency: string;
  amount: string;
  status: string;
  createdAt: string;
  rejectionReason: string | null;
}

const CANCELLABLE_STATUSES = new Set(["PENDING_REVIEW", "PENDING_APPROVAL"]);

const STATUS_VARIANT: Record<string, "neutral" | "positive" | "negative" | "warning"> = {
  PENDING_REVIEW: "neutral",
  PENDING_APPROVAL: "warning",
  EXECUTION_AUTHORIZED: "warning",
  PROCESSING: "warning",
  COMPLETED: "positive",
  REJECTED: "negative",
  FAILED: "negative",
  CANCELLED: "neutral",
};

export function RequestWithdrawalForm({
  balances,
  withdrawals,
}: {
  balances: CurrencyBalance[];
  withdrawals: WithdrawalRow[];
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError(null);
    setSuccess(false);

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      currency: data.get("currency"),
      amount: data.get("amount"),
      destination: {
        method: data.get("method"),
        details: data.get("details"),
      },
    };

    try {
      const response = await apiFetch("/api/wallet/withdrawals", {
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
      router.refresh();
    } catch {
      setFormError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id: string) {
    setCancellingId(id);
    try {
      await apiFetch(`/api/wallet/withdrawals/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <Card className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">Request a withdrawal</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Currency" htmlFor="currency" error={errors.currency}>
              <select
                id="currency"
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
            <Field label="Amount" htmlFor="amount" error={errors.amount}>
              <Input id="amount" name="amount" type="text" inputMode="decimal" required />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payout method" htmlFor="method" error={errors["destination.method"]}>
              <Input id="method" name="method" type="text" placeholder="e.g. bank transfer" required />
            </Field>
            <Field label="Payout details" htmlFor="details" error={errors["destination.details"]}>
              <Input id="details" name="details" type="text" placeholder="Account / address" required />
            </Field>
          </div>
          {success ? (
            <Callout variant="success">
              <p>
                Withdrawal request submitted. It now needs approval from five administrators before
                it can be paid out.
              </p>
            </Callout>
          ) : null}
          {formError ? (
            <Callout variant="danger">
              <p>{formError}</p>
            </Callout>
          ) : null}
          <Button type="submit" disabled={loading} className="self-start">
            {loading ? "Submitting..." : "Request withdrawal"}
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">Your withdrawal requests</h3>
        {withdrawals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No withdrawal requests yet.</p>
        ) : (
          withdrawals.map((withdrawal) => (
            <div
              key={withdrawal.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground">
                  {withdrawal.amount} {withdrawal.currency}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(withdrawal.createdAt).toLocaleString()}
                </span>
                {withdrawal.rejectionReason ? (
                  <span className="text-xs text-negative">{withdrawal.rejectionReason}</span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[withdrawal.status] ?? "neutral"}>
                  {withdrawal.status.replaceAll("_", " ")}
                </Badge>
                {CANCELLABLE_STATUSES.has(withdrawal.status) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={cancellingId === withdrawal.id}
                    onClick={() => handleCancel(withdrawal.id)}
                  >
                    {cancellingId === withdrawal.id ? "Cancelling..." : "Cancel"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
