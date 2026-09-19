create table "deposits" (
	"id" uuid primary key not null,
	"user_id" uuid not null,
	"currency" text not null,
	"method" text not null,
	"status" text default 'PENDING' not null,
	"requested_amount" numeric(38, 18) not null,
	"confirmed_amount" numeric(38, 18),
	"reference_code" text not null,
	"destination_address" text,
	"phone" text,
	"provider_reference" text,
	"tx_hash" text,
	"ready_to_confirm_at" timestamp with time zone,
	"rejection_reason" text,
	"idempotency_key" text,
	"settlement_ledger_entry_id" uuid,
	"placed_at" timestamp with time zone default now() not null,
	"confirmed_at" timestamp with time zone,
	"updated_at" timestamp with time zone default now() not null,
	constraint "deposits_user_id_fk" foreign key ("user_id") references "public"."users"("id"),
	constraint "deposits_currency_fk" foreign key ("currency") references "public"."currencies"("code"),
	constraint "deposits_settlement_ledger_entry_id_fk" foreign key ("settlement_ledger_entry_id") references "public"."ledger_entries"("id"),
	constraint "deposits_reference_code_key" unique ("reference_code"),
	constraint "deposits_method_check" check ("method" in ('CRYPTO', 'MOBILE_MONEY')),
	constraint "deposits_status_check" check ("status" in ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED')),
	constraint "deposits_requested_amount_positive" check ("requested_amount" > 0),
	constraint "deposits_confirmed_amount_positive" check ("confirmed_amount" is null or "confirmed_amount" > 0),
	constraint "deposits_rejection_reason_required" check ("status" <> 'FAILED' or "rejection_reason" is not null),
	constraint "deposits_confirmed_fields_required" check (
		"status" <> 'CONFIRMED' or ("confirmed_amount" is not null and "settlement_ledger_entry_id" is not null)
	),
	constraint "deposits_crypto_destination_required" check ("method" <> 'CRYPTO' or "destination_address" is not null),
	constraint "deposits_mobile_phone_required" check ("method" <> 'MOBILE_MONEY' or "phone" is not null),
	constraint "deposits_tx_hash_crypto_only" check ("method" = 'CRYPTO' or "tx_hash" is null),
	constraint "deposits_tx_hash_required_on_confirm" check ("method" <> 'CRYPTO' or "status" <> 'CONFIRMED' or "tx_hash" is not null)
);

create index "deposits_user_id_idx" on "deposits" ("user_id");
-- The index the lazy-settlement due-query (status='PENDING' and
-- method='MOBILE_MONEY' and ready_to_confirm_at <= now) needs.
create index "deposits_status_method_ready_idx" on "deposits" ("status", "method", "ready_to_confirm_at");
-- Request-level dedup for the two POST /api/deposits/* endpoints.
create unique index "deposits_user_id_idempotency_key_unique" on "deposits" ("user_id", "idempotency_key") where "idempotency_key" is not null;

-- The one real defense against double-crediting a manually-verified
-- deposit: confirmation is entirely admin-typed (a tx hash read off the
-- real chain), so nothing else stops the same on-chain transaction from
-- being used to confirm two different rows.
create unique index "deposits_currency_tx_hash_unique" on "deposits" ("currency", "tx_hash") where "tx_hash" is not null;

-- Same posture as every other table in this project: the app enforces
-- authorization itself via a full/service connection, but RLS is enabled
-- with no policies as defense-in-depth against ever exposing this table
-- through PostgREST.
alter table "deposits" enable row level security;
