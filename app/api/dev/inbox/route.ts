import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { notifications, users } from "@/lib/db/schema";

function isDevInboxAvailable(): boolean {
  return process.env.NODE_ENV !== "production" && (process.env.EMAIL_PROVIDER ?? "dev") === "dev";
}

export async function GET(request: Request) {
  if (!isDevInboxAvailable()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const email = new URL(request.url).searchParams.get("email")?.toLowerCase();

  const rows = await db
    .select({ notification: notifications, userEmail: users.email })
    .from(notifications)
    .innerJoin(users, eq(notifications.userId, users.id))
    .where(email ? eq(users.email, email) : undefined)
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return NextResponse.json({
    items: rows.map((row) => ({ ...row.notification, userEmail: row.userEmail })),
  });
}
