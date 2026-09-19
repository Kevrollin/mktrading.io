import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { DepositDetail, type DepositDetailData } from "@/components/admin/deposit-detail";
import { Container } from "@/components/ui/container";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db/client";
import { deposits } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminDepositDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getCurrentUser();
  if (!admin) return null; // layout already redirects unauthenticated requests

  const [deposit] = await db.select().from(deposits).where(eq(deposits.id, id));
  if (!deposit) {
    notFound();
  }

  const detail: DepositDetailData = {
    id: deposit.id,
    userId: deposit.userId,
    currency: deposit.currency,
    method: deposit.method,
    status: deposit.status,
    requestedAmount: deposit.requestedAmount,
    confirmedAmount: deposit.confirmedAmount,
    referenceCode: deposit.referenceCode,
    destinationAddress: deposit.destinationAddress,
    phone: deposit.phone,
    providerReference: deposit.providerReference,
    txHash: deposit.txHash,
    rejectionReason: deposit.rejectionReason,
    placedAt: deposit.placedAt.toISOString(),
  };

  return (
    <Container className="flex flex-col gap-6 py-12">
      <DepositDetail deposit={detail} currentAdminId={admin.id} />
    </Container>
  );
}
