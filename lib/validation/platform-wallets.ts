import { z } from "zod";

export const setPlatformWalletSchema = z.object({
  address: z.string().trim().min(1).max(200),
  code: z.string().trim().min(6).max(10),
});
