import { z } from "zod";

// Email is deliberately excluded — changing it would need its own
// re-verification flow, deferred for now.
export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  country: z.string().trim().length(2),
  phone: z.string().trim().min(7).max(20),
});
