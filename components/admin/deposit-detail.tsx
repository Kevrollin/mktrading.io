"use client";

import { useRouter } from "next/navigation";
import { StepUpAction } from "@/components/admin/step-up-prompt";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/auth/csrf-client";

export interface DepositDetailData {
  id: string;
  userId: string;
  currency: string;
  method: "CRYPTO" | "MOBILE_MONEY";
  status: "PENDING" | "CONFIRMED" | "FAILED" | "CANCELLED";
  requestedAmount: string;
  confirmedAmount: string | null;
  referenceCode: string;
  destinationAddress: string | null;
  phone: string | null;
  providerReference: string | null;
  txHash: string | null;
  rejectionReason: string | null;
  placedAt: string;
}

async function postAction(path: string, body: Record<string, unknown>): Promise<string | null> {
  const response = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return data.error ?? "Something went wrong.";
}

export function DepositDetail({
  deposit,
  currentAdminId,
}: {
  deposit: DepositDetailData;
  currentAdminId: string;
}) {
  const router = useRouter();
  const isOwnDeposit = deposit.userId === currentAdminId;

  async function withRefresh(action: (formData: FormData) => Promise<string | null>, formData: FormData) {
    const error = await action(formData);
    if (!error) router.refresh();
    return error;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-2xl font-semibold text-foreground">
              {deposit.requestedAmount} {deposit.currency}
            </p>
            <p className="text-xs text-muted-foreground">
              Requested {new Date(deposit.placedAt).toLocaleString()} — {deposit.referenceCode}
            </p>
          </div>
          <Badge variant="warning">{deposit.status}</Badge>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">User</dt>
            <dd className="text-foreground">{deposit.userId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Method</dt>
            <dd className="text-foreground">{deposit.method === "CRYPTO" ? "Crypto" : "M-Pesa"}</dd>
          </div>
          {deposit.method === "CRYPTO" ? (
            <div>
              <dt className="text-muted-foreground">Destination address</dt>
              <dd className="break-all font-mono text-foreground">{deposit.destinationAddress}</dd>
            </div>
          ) : (
            <>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="text-foreground">{deposit.phone}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Provider reference</dt>
                <dd className="text-foreground">{deposit.providerReference}</dd>
              </div>
            </>
          )}
          {deposit.confirmedAmount ? (
            <div>
              <dt className="text-muted-foreground">Confirmed amount</dt>
              <dd className="text-foreground">{deposit.confirmedAmount}</dd>
            </div>
          ) : null}
          {deposit.txHash ? (
            <div>
              <dt className="text-muted-foreground">Tx hash</dt>
              <dd className="break-all font-mono text-foreground">{deposit.txHash}</dd>
            </div>
          ) : null}
          {deposit.rejectionReason ? (
            <div>
              <dt className="text-muted-foreground">Rejection reason</dt>
              <dd className="text-negative">{deposit.rejectionReason}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      {deposit.method === "MOBILE_MONEY" && deposit.status === "PENDING" ? (
        <Callout variant="info">
          <p>
            Mobile money deposits confirm automatically once the simulated STK push completes — no admin
            action is normally needed unless something is stuck.
          </p>
        </Callout>
      ) : null}

      {isOwnDeposit ? (
        <Callout variant="warning">
          <p>This is your own deposit request — you cannot confirm or reject it.</p>
        </Callout>
      ) : null}

      {!isOwnDeposit && deposit.status === "PENDING" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {deposit.method === "CRYPTO" ? (
            <StepUpAction
              title="Confirm deposit"
              confirmLabel="Confirm deposit"
              extraFields={
                <div className="flex flex-col gap-4">
                  <Field label="Transaction hash" htmlFor="tx-hash">
                    <Input id="tx-hash" name="txHash" required minLength={4} maxLength={200} />
                  </Field>
                  <Field label="Confirmed amount" htmlFor="confirmed-amount">
                    <Input
                      id="confirmed-amount"
                      name="confirmedAmount"
                      required
                      inputMode="decimal"
                      defaultValue={deposit.requestedAmount}
                    />
                  </Field>
                </div>
              }
              onSubmit={(formData) =>
                withRefresh(
                  (fd) =>
                    postAction(`/api/admin/deposits/${deposit.id}/confirm-crypto`, {
                      code: fd.get("code"),
                      txHash: fd.get("txHash"),
                      confirmedAmount: fd.get("confirmedAmount"),
                    }),
                  formData,
                )
              }
            />
          ) : null}
          <StepUpAction
            title="Reject"
            variant="outline"
            confirmLabel="Reject deposit"
            extraFields={
              <Field label="Reason" htmlFor="reject-reason">
                <Input id="reject-reason" name="reason" required minLength={3} maxLength={500} />
              </Field>
            }
            onSubmit={(formData) =>
              withRefresh(
                (fd) =>
                  postAction(`/api/admin/deposits/${deposit.id}/reject`, {
                    code: fd.get("code"),
                    reason: fd.get("reason"),
                  }),
                formData,
              )
            }
          />
        </div>
      ) : null}
    </div>
  );
}
