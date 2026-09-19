"use client";

import { useRouter } from "next/navigation";
import { ApprovalProgress, type ApprovalRow } from "@/components/admin/approval-progress";
import { StepUpAction } from "@/components/admin/step-up-prompt";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/auth/csrf-client";

export interface WithdrawalDetailData {
  id: string;
  userId: string;
  currency: string;
  amount: string;
  destination: Record<string, unknown>;
  status: string;
  approvalsRequiredCount: number;
  rejectionReason: string | null;
  providerReference: string | null;
  createdAt: string;
}

const REJECTABLE_STATUSES = new Set(["PENDING_REVIEW", "PENDING_APPROVAL", "EXECUTION_AUTHORIZED", "PROCESSING"]);

async function postAction(path: string, body: Record<string, unknown>): Promise<string | null> {
  const response = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return data.error ?? "Something went wrong.";
}

export function WithdrawalDetail({
  withdrawal,
  approvals,
  currentAdminId,
}: {
  withdrawal: WithdrawalDetailData;
  approvals: ApprovalRow[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const isOwnWithdrawal = withdrawal.userId === currentAdminId;

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
              {withdrawal.amount} {withdrawal.currency}
            </p>
            <p className="text-xs text-muted-foreground">
              Requested {new Date(withdrawal.createdAt).toLocaleString()}
            </p>
          </div>
          <Badge variant="warning">{withdrawal.status.replaceAll("_", " ")}</Badge>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">User</dt>
            <dd className="text-foreground">{withdrawal.userId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Destination</dt>
            <dd className="text-foreground">{JSON.stringify(withdrawal.destination)}</dd>
          </div>
          {withdrawal.providerReference ? (
            <div>
              <dt className="text-muted-foreground">Provider reference</dt>
              <dd className="text-foreground">{withdrawal.providerReference}</dd>
            </div>
          ) : null}
          {withdrawal.rejectionReason ? (
            <div>
              <dt className="text-muted-foreground">Rejection reason</dt>
              <dd className="text-negative">{withdrawal.rejectionReason}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <h3 className="text-sm font-semibold text-foreground">5-of-5 approval progress</h3>
        <ApprovalProgress approvals={approvals} required={withdrawal.approvalsRequiredCount} />
      </Card>

      {isOwnWithdrawal ? (
        <Callout variant="warning">
          <p>This is your own withdrawal request — you cannot approve or reject it.</p>
        </Callout>
      ) : null}

      {!isOwnWithdrawal && withdrawal.status === "PENDING_APPROVAL" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <StepUpAction
            title="Approve"
            confirmLabel="Approve withdrawal"
            onSubmit={(formData) =>
              withRefresh(
                (fd) => postAction(`/api/admin/withdrawals/${withdrawal.id}/approve`, { code: fd.get("code") }),
                formData,
              )
            }
          />
          <StepUpAction
            title="Reject"
            variant="outline"
            confirmLabel="Reject withdrawal"
            extraFields={
              <Field label="Reason" htmlFor="reject-reason">
                <Input id="reject-reason" name="reason" required minLength={3} maxLength={500} />
              </Field>
            }
            onSubmit={(formData) =>
              withRefresh(
                (fd) =>
                  postAction(`/api/admin/withdrawals/${withdrawal.id}/reject`, {
                    code: fd.get("code"),
                    reason: fd.get("reason"),
                  }),
                formData,
              )
            }
          />
        </div>
      ) : null}

      {!isOwnWithdrawal && withdrawal.status === "EXECUTION_AUTHORIZED" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <StepUpAction
            title="Mark processing"
            confirmLabel="Start processing"
            onSubmit={(formData) =>
              withRefresh(
                (fd) => postAction(`/api/admin/withdrawals/${withdrawal.id}/processing`, { code: fd.get("code") }),
                formData,
              )
            }
          />
          <StepUpAction
            title="Reject"
            variant="outline"
            confirmLabel="Reject withdrawal"
            extraFields={
              <Field label="Reason" htmlFor="reject-reason-2">
                <Input id="reject-reason-2" name="reason" required minLength={3} maxLength={500} />
              </Field>
            }
            onSubmit={(formData) =>
              withRefresh(
                (fd) =>
                  postAction(`/api/admin/withdrawals/${withdrawal.id}/reject`, {
                    code: fd.get("code"),
                    reason: fd.get("reason"),
                  }),
                formData,
              )
            }
          />
        </div>
      ) : null}

      {!isOwnWithdrawal && withdrawal.status === "PROCESSING" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <StepUpAction
            title="Mark completed"
            confirmLabel="Mark completed"
            extraFields={
              <Field label="Provider reference" htmlFor="provider-reference">
                <Input id="provider-reference" name="providerReference" required minLength={1} maxLength={200} />
              </Field>
            }
            onSubmit={(formData) =>
              withRefresh(
                (fd) =>
                  postAction(`/api/admin/withdrawals/${withdrawal.id}/complete`, {
                    code: fd.get("code"),
                    providerReference: fd.get("providerReference"),
                  }),
                formData,
              )
            }
          />
          <StepUpAction
            title="Reject"
            variant="outline"
            confirmLabel="Reject withdrawal"
            extraFields={
              <Field label="Reason" htmlFor="reject-reason-3">
                <Input id="reject-reason-3" name="reason" required minLength={3} maxLength={500} />
              </Field>
            }
            onSubmit={(formData) =>
              withRefresh(
                (fd) =>
                  postAction(`/api/admin/withdrawals/${withdrawal.id}/reject`, {
                    code: fd.get("code"),
                    reason: fd.get("reason"),
                  }),
                formData,
              )
            }
          />
        </div>
      ) : null}

      {REJECTABLE_STATUSES.has(withdrawal.status) === false ? (
        <Callout variant="info">
          <p>This withdrawal has reached a final state and needs no further action.</p>
        </Callout>
      ) : null}
    </div>
  );
}
