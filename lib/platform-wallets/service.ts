import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { currencies, platformWallets } from "@/lib/db/schema";
import type { CurrencyKind } from "@/lib/db/schema";

export interface PlatformWalletRow {
  currency: string;
  kind: CurrencyKind;
  address: string | null;
  updatedAt: Date | null;
}

export async function listPlatformWallets(): Promise<PlatformWalletRow[]> {
  return db
    .select({
      currency: currencies.code,
      kind: currencies.kind,
      address: platformWallets.address,
      updatedAt: platformWallets.updatedAt,
    })
    .from(currencies)
    .leftJoin(platformWallets, eq(platformWallets.currency, currencies.code))
    .where(eq(currencies.isActive, true));
}

export interface SetPlatformWalletInput {
  currency: string;
  address: string;
  adminUserId: string;
}

export async function setPlatformWalletAddress(input: SetPlatformWalletInput): Promise<void> {
  await db
    .insert(platformWallets)
    .values({
      currency: input.currency,
      address: input.address,
      updatedByUserId: input.adminUserId,
    })
    .onConflictDoUpdate({
      target: platformWallets.currency,
      set: {
        address: input.address,
        updatedByUserId: input.adminUserId,
        updatedAt: new Date(),
      },
    });
}
