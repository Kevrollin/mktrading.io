import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema/users";

export const mfaCredentials = pgTable("mfa_credentials", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // One TOTP credential per user this milestone.
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  // AES-256-GCM ciphertext (iv + tag packed in) — never plaintext. A DB leak
  // of a plaintext secret would be an instant MFA bypass for every user.
  secretEncrypted: text("secret_encrypted").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Null until the user proves possession with a real code post-enrollment.
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const mfaBackupCodes = pgTable(
  "mfa_backup_codes",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    // Regenerating invalidates the whole previous batch atomically.
    batchId: uuid("batch_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => [index("mfa_backup_codes_user_id_idx").on(table.userId)],
);

// Bridges "password verified" and "full session issued" for accounts with
// MFA enabled — same opaque-token-hash pattern as sessions/trusted
// devices, rather than a stateless signed cookie, so every "prove
// possession of a secret" mechanism in this codebase works identically.
// No consumedAt: a failed MFA attempt must leave this valid so the user
// can retry within the rate limit; a successful one deletes the row.
// "Remember this device" is submitted fresh on the verify request itself
// (mfaVerifySchema), not stored here.
export const mfaPendingLogins = pgTable(
  "mfa_pending_logins",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("mfa_pending_logins_user_id_idx").on(table.userId)],
);
