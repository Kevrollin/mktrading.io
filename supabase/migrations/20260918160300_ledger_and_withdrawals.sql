-- Milestone 3: double-entry ledger, multi-currency wallet accounts, and the
-- withdrawal request + 5-of-5 admin approval workflow. See
-- lib/db/schema/{currencies,ledger,withdrawals}.ts for the Drizzle mirror
-- used for type-safe querying.

create table "currencies" (
	"code" text primary key,
	"name" text not null,
	"kind" text not null,
	"decimals" smallint not null,
	"is_active" boolean default true not null
);

create table "ledger_accounts" (
	"id" uuid primary key not null,
	"owner_type" text not null,
	"owner_user_id" uuid,
	"currency" text not null,
	"account_type" text not null,
	"balance" numeric(38, 18) default '0' not null,
	"created_at" timestamp with time zone default now() not null,
	"updated_at" timestamp with time zone default now() not null,
	constraint "ledger_accounts_owner_user_id_users_id_fk" foreign key ("owner_user_id") references "public"."users"("id") on delete restrict,
	constraint "ledger_accounts_currency_currencies_code_fk" foreign key ("currency") references "public"."currencies"("code"),
	-- SYSTEM owners are exactly the TREASURY accounts; USER owners are
	-- exactly AVAILABLE/LOCKED.
	constraint "ledger_accounts_owner_shape" check (
		(owner_type = 'SYSTEM' and owner_user_id is null and account_type = 'TREASURY')
		or (owner_type = 'USER' and owner_user_id is not null and account_type in ('AVAILABLE', 'LOCKED'))
	),
	-- TREASURY is the only account allowed to go negative — it tracks the
	-- platform's net unbacked-liability from admin-issued demo credits,
	-- not a real cash position.
	constraint "ledger_accounts_balance_floor" check (account_type = 'TREASURY' or balance >= 0)
);

create index "ledger_accounts_owner_user_id_idx" on "ledger_accounts" ("owner_user_id");
create index "ledger_accounts_currency_idx" on "ledger_accounts" ("currency");
-- Partial unique indexes: one row per (user, currency, bucket); exactly one
-- TREASURY row per currency. Not expressible via Drizzle's table builder.
create unique index "ledger_accounts_user_unique" on "ledger_accounts" ("owner_user_id", "currency", "account_type") where "owner_type" = 'USER';
create unique index "ledger_accounts_system_unique" on "ledger_accounts" ("currency", "account_type") where "owner_type" = 'SYSTEM';

create table "ledger_entries" (
	"id" uuid primary key not null,
	"debit_account_id" uuid not null,
	"credit_account_id" uuid not null,
	"amount" numeric(38, 18) not null,
	"currency" text not null,
	"reference" text not null,
	"transaction_type" text not null,
	"actor_user_id" uuid not null,
	"metadata" jsonb default '{}' not null,
	"idempotency_key" text not null,
	"created_at" timestamp with time zone default now() not null,
	constraint "ledger_entries_debit_account_id_fk" foreign key ("debit_account_id") references "public"."ledger_accounts"("id"),
	constraint "ledger_entries_credit_account_id_fk" foreign key ("credit_account_id") references "public"."ledger_accounts"("id"),
	constraint "ledger_entries_currency_currencies_code_fk" foreign key ("currency") references "public"."currencies"("code"),
	constraint "ledger_entries_actor_user_id_users_id_fk" foreign key ("actor_user_id") references "public"."users"("id"),
	constraint "ledger_entries_amount_positive" check (amount > 0)
);

create index "ledger_entries_debit_account_id_idx" on "ledger_entries" ("debit_account_id");
create index "ledger_entries_credit_account_id_idx" on "ledger_entries" ("credit_account_id");
create index "ledger_entries_idempotency_key_idx" on "ledger_entries" ("idempotency_key");
create index "ledger_entries_transaction_type_idx" on "ledger_entries" ("transaction_type");

-- Immutability is a hard DB guarantee, not application convention — the
-- app connects with the same full-access credential it always has, so
-- nothing else would stop a future bug from mutating an audit-critical row.
create or replace function ledger_entries_immutable() returns trigger as $$
begin
  raise exception 'ledger_entries rows are immutable';
end;
$$ language plpgsql;

create trigger ledger_entries_no_update_delete
	before update or delete on ledger_entries
	for each row execute function ledger_entries_immutable();

-- Defense in depth: the entry's currency must match both accounts' currency.
create or replace function ledger_entries_currency_matches() returns trigger as $$
declare
  debit_currency text;
  credit_currency text;
begin
  select currency into debit_currency from ledger_accounts where id = new.debit_account_id;
  select currency into credit_currency from ledger_accounts where id = new.credit_account_id;
  if debit_currency is distinct from new.currency or credit_currency is distinct from new.currency then
    raise exception 'ledger_entries.currency must match both accounts currency';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger ledger_entries_currency_check
	before insert on ledger_entries
	for each row execute function ledger_entries_currency_matches();

create table "idempotency_keys" (
	"key" text primary key,
	"scope" text not null,
	"request_hash" text not null,
	"result_snapshot" jsonb,
	"created_at" timestamp with time zone default now() not null
);

create table "withdrawals" (
	"id" uuid primary key not null,
	"user_id" uuid not null,
	"currency" text not null,
	"amount" numeric(38, 18) not null,
	"destination" jsonb not null,
	"status" text default 'PENDING_REVIEW' not null,
	"request_hash" text not null,
	"approvals_required_count" smallint default 5 not null,
	"lock_ledger_entry_id" uuid,
	"settlement_ledger_entry_id" uuid,
	"rejection_reason" text,
	"provider_reference" text,
	"created_at" timestamp with time zone default now() not null,
	"updated_at" timestamp with time zone default now() not null,
	constraint "withdrawals_user_id_users_id_fk" foreign key ("user_id") references "public"."users"("id"),
	constraint "withdrawals_currency_currencies_code_fk" foreign key ("currency") references "public"."currencies"("code"),
	constraint "withdrawals_lock_ledger_entry_id_fk" foreign key ("lock_ledger_entry_id") references "public"."ledger_entries"("id"),
	constraint "withdrawals_settlement_ledger_entry_id_fk" foreign key ("settlement_ledger_entry_id") references "public"."ledger_entries"("id"),
	constraint "withdrawals_amount_positive" check (amount > 0),
	constraint "withdrawals_rejection_reason_required" check (status <> 'REJECTED' or rejection_reason is not null)
);

create index "withdrawals_user_id_idx" on "withdrawals" ("user_id");
create index "withdrawals_status_idx" on "withdrawals" ("status");

create table "withdrawal_approvals" (
	"id" uuid primary key not null,
	"withdrawal_id" uuid not null,
	"admin_user_id" uuid not null,
	"request_hash" text not null,
	"created_at" timestamp with time zone default now() not null,
	constraint "withdrawal_approvals_withdrawal_id_fk" foreign key ("withdrawal_id") references "public"."withdrawals"("id") on delete cascade,
	constraint "withdrawal_approvals_admin_user_id_fk" foreign key ("admin_user_id") references "public"."users"("id"),
	-- The DB-level guarantee behind "an admin cannot approve twice."
	constraint "withdrawal_approvals_withdrawal_id_admin_user_id_unique" unique ("withdrawal_id", "admin_user_id")
);

create index "withdrawal_approvals_withdrawal_id_idx" on "withdrawal_approvals" ("withdrawal_id");

-- Same posture as every other table in this project: the app enforces
-- authorization itself via a full/service connection, but RLS is enabled
-- with no policies as defense-in-depth against ever exposing these
-- tables through PostgREST.
alter table "currencies" enable row level security;
alter table "ledger_accounts" enable row level security;
alter table "ledger_entries" enable row level security;
alter table "idempotency_keys" enable row level security;
alter table "withdrawals" enable row level security;
alter table "withdrawal_approvals" enable row level security;
