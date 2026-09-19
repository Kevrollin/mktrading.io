import { NextResponse } from "next/server";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { ForbiddenError, requireSuperAdminApi } from "@/lib/auth/rbac";
import { getClientIp } from "@/lib/auth/request-context";
import { verifyAdminStepUp } from "@/lib/auth/step-up";
import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";
import { TRADE_DURATIONS_SECONDS } from "@/lib/trading/durations";
import { updateInstrument } from "@/lib/trading/instruments-service";
import { updateInstrumentSchema } from "@/lib/validation/trading";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const parsed = updateInstrumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { code, allowedDurationsSeconds, ...changes } = parsed.data;

  if (allowedDurationsSeconds) {
    const allValid = allowedDurationsSeconds.every((seconds) =>
      (TRADE_DURATIONS_SECONDS as readonly number[]).includes(seconds),
    );
    if (!allValid) {
      return NextResponse.json({ error: "Invalid duration in the selected set." }, { status: 400 });
    }
  }

  const stepUp = await verifyAdminStepUp(admin.id, code);
  if (!stepUp.allowed) {
    const status = stepUp.reason === "rate_limited" ? 429 : 400;
    return NextResponse.json(
      { error: stepUp.reason === "rate_limited" ? "Too many attempts. Try again later." : "Incorrect code." },
      { status },
    );
  }

  const { id } = await params;
  try {
    const instrument = await updateInstrument({
      id,
      adminUserId: admin.id,
      allowedDurationsSeconds,
      ...changes,
    });

    await db.insert(auditLogs).values({
      actorUserId: admin.id,
      action: "instrument.updated",
      targetType: "instrument",
      targetId: id,
      after: { allowedDurationsSeconds, ...changes },
      ip: getClientIp(request),
      correlationId: crypto.randomUUID(),
    });

    return NextResponse.json({ instrument });
  } catch {
    return NextResponse.json({ error: "Instrument not found." }, { status: 404 });
  }
}
