"use client";

import { useRouter } from "next/navigation";
import { StepUpAction } from "@/components/admin/step-up-prompt";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/auth/csrf-client";

export interface PlatformWalletRow {
  currency: string;
  address: string | null;
  updatedAt: string | null;
}

async function submitAddress(currency: string, formData: FormData): Promise<string | null> {
  const response = await apiFetch(`/api/admin/platform-wallets/${currency}`, {
    method: "POST",
    body: JSON.stringify({ address: formData.get("address"), code: formData.get("code") }),
  });
  if (response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return data.error ?? "Something went wrong.";
}

export function PlatformWalletForm({ wallets }: { wallets: PlatformWalletRow[] }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      {wallets.map((wallet) => (
        <Card key={wallet.currency} className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">{wallet.currency} receiving address</h2>
            <Badge variant={wallet.address ? "positive" : "warning"}>
              {wallet.address ? "Configured" : "Not set"}
            </Badge>
          </div>

          {wallet.address ? (
            <p className="break-all rounded-[var(--radius)] bg-muted p-3 font-mono text-sm text-foreground">
              {wallet.address}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No deposit address configured yet — customer deposits in {wallet.currency} cannot be
              received until one is set.
            </p>
          )}

          <StepUpAction
            title={`${wallet.address ? "Update" : "Set"} ${wallet.currency} address`}
            confirmLabel={wallet.address ? "Update address" : "Set address"}
            extraFields={
              <Field label={`${wallet.currency} address`} htmlFor={`address-${wallet.currency}`}>
                <Input
                  id={`address-${wallet.currency}`}
                  name="address"
                  required
                  minLength={1}
                  maxLength={200}
                  placeholder={wallet.currency === "BTC" ? "bc1q..., 1..., or 3..." : "Paste the new address"}
                />
              </Field>
            }
            onSubmit={async (formData) => {
              const error = await submitAddress(wallet.currency, formData);
              if (!error) router.refresh();
              return error;
            }}
          />
        </Card>
      ))}
    </div>
  );
}
