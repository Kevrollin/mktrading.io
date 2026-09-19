import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { instruments } from "@/lib/db/schema";
import type { InstrumentCategory } from "@/lib/db/schema";

export interface InstrumentRow {
  id: string;
  symbol: string;
  name: string;
  category: InstrumentCategory;
  isActive: boolean;
  payoutPercent: string;
  allowedDurationsSeconds: number[];
  minStake: string | null;
  maxStake: string | null;
  updatedAt: Date;
}

export async function listInstruments(activeOnly = true): Promise<InstrumentRow[]> {
  const rows = activeOnly
    ? await db.select().from(instruments).where(eq(instruments.isActive, true))
    : await db.select().from(instruments);
  return rows;
}

export async function getInstrument(id: string): Promise<InstrumentRow | null> {
  const [row] = await db.select().from(instruments).where(eq(instruments.id, id));
  return row ?? null;
}

export interface UpdateInstrumentInput {
  id: string;
  adminUserId: string;
  payoutPercent?: string;
  isActive?: boolean;
  allowedDurationsSeconds?: number[];
  minStake?: string | null;
  maxStake?: string | null;
}

export async function updateInstrument(input: UpdateInstrumentInput): Promise<InstrumentRow> {
  const { id, adminUserId, ...changes } = input;
  const [updated] = await db
    .update(instruments)
    .set({ ...changes, updatedByUserId: adminUserId, updatedAt: new Date() })
    .where(eq(instruments.id, id))
    .returning();
  if (!updated) {
    throw new Error(`Instrument ${id} not found.`);
  }
  return updated;
}
