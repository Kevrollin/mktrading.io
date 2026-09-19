import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { WithdrawalDetail, type WithdrawalDetailData } from "@/components/admin/withdrawal-detail";
import type { ApprovalRow } from "@/components/admin/approval-progress";
import { Container } from "@/components/ui/container";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db/client";
import { withdrawalApprovals, withdrawals } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminWithdrawalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await getCurrentUser();
  if (!admin) return null; // layout already redirects unauthenticated requests

  const [withdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.id, id));
  if (!withdrawal) {
    notFound();
  }

  const approvalRows = await db
    .select()
    .from(withdrawalApprovals)
    .where(eq(withdrawalApprovals.withdrawalId, id));

  const detail: WithdrawalDetailData = {
    id: withdrawal.id,
    userId: withdrawal.userId,
    currency: withdrawal.currency,
    amount: withdrawal.amount,
    destination: withdrawal.destination as Record<string, unknown>,
    status: withdrawal.status,
    approvalsRequiredCount: withdrawal.approvalsRequiredCount,
    rejectionReason: withdrawal.rejectionReason,
    providerReference: withdrawal.providerReference,
    createdAt: withdrawal.createdAt.toISOString(),
  };

  const approvals: ApprovalRow[] = approvalRows.map((row) => ({
    adminUserId: row.adminUserId,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <Container className="flex flex-col gap-6 py-12">
      <WithdrawalDetail withdrawal={detail} approvals={approvals} currentAdminId={admin.id} />
    </Container>
  );
}
