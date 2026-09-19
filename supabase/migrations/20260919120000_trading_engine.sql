-- Ids/symbols/names reuse lib/demo-markets.ts (the marketing placeholder
-- data) for continuity — the two are independent sources of truth, not
-- automatically synced.
create table "instruments" (
	"id" text primary key not null,
	"symbol" text not null unique,
	"name" text not null,
	"category" text not null,
	"is_active" boolean default true not null,
	"payout_percent" numeric(5, 2) not null,
	"allowed_durations_seconds" smallint[] not null,
	"min_stake" numeric(38, 18),
	"max_stake" numeric(38, 18),
	"updated_by_user_id" uuid,
	"updated_at" timestamp with time zone default now() not null,
	"created_at" timestamp with time zone default now() not null,
	constraint "instruments_updated_by_user_id_fk" foreign key ("updated_by_user_id") references "public"."users"("id"),
	constraint "instruments_category_check" check ("category" in ('rapid', 'standard', 'range-bound')),
	constraint "instruments_payout_percent_positive" check ("payout_percent" > 0)
);

create table "trades" (
	"id" uuid primary key not null,
	"user_id" uuid not null,
	"instrument_id" text not null,
	"currency" text not null,
	"direction" text not null,
	"duration_seconds" smallint not null,
	"stake_amount" numeric(38, 18) not null,
	-- Snapshotted from the instrument at placement — never re-read live at
	-- settlement, same principle as withdrawals.request_hash.
	"payout_percent" numeric(5, 2) not null,
	"entry_price" numeric(20, 8) not null,
	"settlement_price" numeric(20, 8),
	"status" text default 'OPEN' not null,
	"placed_at" timestamp with time zone default now() not null,
	"expires_at" timestamp with time zone not null,
	"settled_at" timestamp with time zone,
	"stake_lock_ledger_entry_id" uuid,
	"settlement_ledger_entry_id" uuid,
	"profit_ledger_entry_id" uuid,
	"refund_reason" text,
	"updated_at" timestamp with time zone default now() not null,
	constraint "trades_user_id_fk" foreign key ("user_id") references "public"."users"("id"),
	constraint "trades_instrument_id_fk" foreign key ("instrument_id") references "public"."instruments"("id"),
	constraint "trades_currency_fk" foreign key ("currency") references "public"."currencies"("code"),
	constraint "trades_stake_lock_ledger_entry_id_fk" foreign key ("stake_lock_ledger_entry_id") references "public"."ledger_entries"("id"),
	constraint "trades_settlement_ledger_entry_id_fk" foreign key ("settlement_ledger_entry_id") references "public"."ledger_entries"("id"),
	constraint "trades_profit_ledger_entry_id_fk" foreign key ("profit_ledger_entry_id") references "public"."ledger_entries"("id"),
	constraint "trades_direction_check" check ("direction" in ('RISE', 'FALL')),
	constraint "trades_status_check" check ("status" in ('OPEN', 'WON', 'LOST', 'REFUNDED')),
	constraint "trades_stake_amount_positive" check ("stake_amount" > 0),
	constraint "trades_expires_after_placed" check ("expires_at" > "placed_at"),
	constraint "trades_refund_reason_required" check ("status" <> 'REFUNDED' or "refund_reason" is not null)
);

create index "trades_user_id_idx" on "trades" ("user_id");
-- The index the "find due trades" query (status = 'OPEN' and expires_at
-- <= now()) actually needs.
create index "trades_status_expires_at_idx" on "trades" ("status", "expires_at");
create index "trades_instrument_id_idx" on "trades" ("instrument_id");

-- Same posture as every other table in this project: the app enforces
-- authorization itself via a full/service connection, but RLS is enabled
-- with no policies as defense-in-depth against ever exposing these
-- tables through PostgREST.
alter table "instruments" enable row level security;
alter table "trades" enable row level security;
