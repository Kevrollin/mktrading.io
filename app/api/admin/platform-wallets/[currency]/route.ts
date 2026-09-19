import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { ForbiddenError, requireSuperAdminApi } from "@/lib/auth/rbac";
import { getClientIp } from "@/lib/auth/request-context";
import { verifyAdminStepUp } from "@/lib/auth/step-up";
import { db } from "@/lib/db/client";
import { auditLogs, currencies } from "@/lib/db/schema";
import { isValidPlatformWalletAddress } from "@/lib/platform-wallets/validate-address";
import { setPlatformWalletAddress } from "@/lib/platform-wallets/service";
import { setPlatformWalletSchema } from "@/lib/validation/platform-wallets";

export async function POST(request: Request, { params }: { params: Promise<{ currency: string }> }) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  let admin;
  try {
    ({ user: admin } = await requireSuperAdminApi());
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = setPlatformWalletSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const stepUp = await verifyAdminStepUp(admin.id, parsed.data.code);
  if (!stepUp.allowed) {
    const status = stepUp.reason === "rate_limited" ? 429 : 400;
    return NextResponse.json(
      { error: stepUp.reason === "rate_limited" ? "Too many attempts. Try again later." : "Incorrect code." },
      { status },
    );
  }

  const { currency: rawCurrency } = await params;
  const currency = rawCurrency.toUpperCase();

  const [currencyRow] = await db.select().from(currencies).where(eq(currencies.code, currency));
  if (!currencyRow || !currencyRow.isActive) {
    return NextResponse.json({ error: "Unsupported currency." }, { status: 400 });
  }
  if (currencyRow.kind !== "CRYPTO") {
    return NextResponse.json(
      { error: "Only crypto currencies have a platform receiving address." },
      { status: 400 },
    );
  }

  const address = parsed.data.address.trim();
  if (!isValidPlatformWalletAddress(currency, address)) {
    return NextResponse.json({ error: `That doesn't look like a valid ${currency} address.` }, { status: 400 });
  }

  await setPlatformWalletAddress({ currency, address, adminUserId: admin.id });

  await db.insert(auditLogs).values({
    actorUserId: admin.id,
    action: "platform_wallet.updated",
    targetType: "platform_wallet",
    targetId: currency,
    after: { address },
    ip: getClientIp(request),
    correlationId: crypto.randomUUID(),
  });

  return NextResponse.json({ success: true });
}
