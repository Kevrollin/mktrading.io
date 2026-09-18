import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { profiles, users } from "@/lib/db/schema";
import { assertCsrfSafe } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/dal";
import { isCountryEligible } from "@/lib/compliance/eligible-countries";
import { updateProfileSchema } from "@/lib/validation/profile";

export async function POST(request: Request) {
  if (!(await assertCsrfSafe(request))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input.", issues: parsed.error.issues }, { status: 400 });
  }
  const { fullName, country, phone } = parsed.data;

  if (!isCountryEligible(country)) {
    return NextResponse.json(
      { error: "MKTrading is not currently available in that country." },
      { status: 400 },
    );
  }

  const [existingPhoneOwner] = await db.select().from(users).where(eq(users.phone, phone));
  if (existingPhoneOwner && existingPhoneOwner.id !== user.id) {
    return NextResponse.json({ error: "That phone number is already in use." }, { status: 400 });
  }

  await db.update(profiles).set({ fullName, country }).where(eq(profiles.userId, user.id));
  await db.update(users).set({ phone }).where(eq(users.id, user.id));

  return NextResponse.json({ success: true });
}
