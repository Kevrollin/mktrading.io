-- The platform's own receiving address per crypto currency — where real
-- customer deposits would actually land. Distinct from
-- ledger_accounts' TREASURY row (an internal accounting bucket, no
-- real-world address). SUPER_ADMIN-only at the application layer.
create table "platform_wallets" (
	"currency" text primary key not null,
	"address" text,
	"updated_by_user_id" uuid,
	"updated_at" timestamp with time zone default now() not null,
	constraint "platform_wallets_currency_fk" foreign key ("currency") references "public"."currencies"("code"),
	constraint "platform_wallets_updated_by_user_id_fk" foreign key ("updated_by_user_id") references "public"."users"("id")
);

alter table "platform_wallets" enable row level security;
