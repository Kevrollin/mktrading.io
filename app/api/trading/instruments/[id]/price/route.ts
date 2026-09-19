import { NextResponse } from "next/server";
import { RATE_LIMITS } from "@/lib/auth/constants";
import { getCurrentUser } from "@/lib/auth/dal";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getInstrument } from "@/lib/trading/instruments-service";
import { priceAt } from "@/lib/trading/price-engine";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const rateCheck = await checkRateLimit(`trading-price-poll:${user.id}`, RATE_LIMITS.tradingPricePollPerUser);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const { id } = await params;
  const instrument = await getInstrument(id);
  if (!instrument || !instrument.isActive) {
    return NextResponse.json({ error: "Unknown instrument." }, { status: 404 });
  }

  const timestampMs = Date.now();
  const price = priceAt(id, timestampMs);
  return NextResponse.json({ timestampMs, price });
}
