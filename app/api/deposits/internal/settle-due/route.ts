import { NextResponse } from "next/server";
import { settleAllDueDeposits } from "@/lib/deposits/state-machine";

/**
 * Not wired to anything yet — no cron/scheduler exists in this
 * deployment. Exists so that once one does, closing the "abandoned
 * session" settlement gap (lib/deposits/state-machine.ts) is a one-line
 * wiring job, not a redesign. Shared-secret header auth, not session
 * auth, since this is meant to be called by infrastructure, not a user.
 */
export async function POST(request: Request) {
  const secret = process.env.SETTLE_DUE_SECRET;
  const provided = request.headers.get("x-settle-due-secret");
  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const settledCount = await settleAllDueDeposits();
  return NextResponse.json({ settledCount });
}
