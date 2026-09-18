-- MKTrading initial schema: authentication, sessions, MFA, RBAC groundwork,
-- rate limiting, notifications, and audit logging. See lib/db/schema/*.ts
-- for the Drizzle mirror of this schema used for type-safe querying.

-- Explicit rather than assumed: needed for gen_random_uuid() in seed.sql
-- (application code generates its own UUIDs via crypto.randomUUID(), but
-- reference-data seeding is plain SQL).
create extension if not exists pgcrypto;

create table "users" (
	"id" uuid primary key not null,
	"email" text not null,
	"phone" text not null,
	"password_hash" text not null,
	"email_verified_at" timestamp with time zone,
	"status" text default 'active' not null,
	"created_at" timestamp with time zone default now() not null,
	"updated_at" timestamp with time zone default now() not null,
	constraint "users_email_unique" unique("email"),
	constraint "users_phone_unique" unique("phone")
);

create table "profiles" (
	"user_id" uuid primary key not null,
	"full_name" text not null,
	"country" text not null,
	"date_of_birth" date not null,
	"terms_accepted_at" timestamp with time zone not null,
	"risk_disclosure_accepted_at" timestamp with time zone not null
);

create table "sessions" (
	"id" uuid primary key not null,
	"user_id" uuid not null,
	"token_hash" text not null,
	"created_at" timestamp with time zone default now() not null,
	"last_active_at" timestamp with time zone default now() not null,
	"expires_at" timestamp with time zone not null,
	"absolute_expires_at" timestamp with time zone not null,
	"user_agent" text,
	"ip" text,
	"revoked_at" timestamp with time zone,
	constraint "sessions_token_hash_unique" unique("token_hash")
);

create table "trusted_devices" (
	"id" uuid primary key not null,
	"user_id" uuid not null,
	"token_hash" text not null,
	"created_at" timestamp with time zone default now() not null,
	"expires_at" timestamp with time zone not null,
	"user_agent" text,
	"ip" text,
	"revoked_at" timestamp with time zone,
	constraint "trusted_devices_token_hash_unique" unique("token_hash")
);

create table "roles" (
	"id" uuid primary key not null,
	"name" text not null,
	"description" text not null,
	constraint "roles_name_unique" unique("name")
);

create table "user_roles" (
	"user_id" uuid not null,
	"role_id" uuid not null,
	"granted_at" timestamp with time zone default now() not null,
	"granted_by" uuid,
	constraint "user_roles_user_id_role_id_pk" primary key("user_id", "role_id")
);

create table "email_verification_tokens" (
	"id" uuid primary key not null,
	"user_id" uuid not null,
	"token_hash" text not null,
	"created_at" timestamp with time zone default now() not null,
	"expires_at" timestamp with time zone not null,
	"consumed_at" timestamp with time zone,
	constraint "email_verification_tokens_token_hash_unique" unique("token_hash")
);

create table "password_reset_tokens" (
	"id" uuid primary key not null,
	"user_id" uuid not null,
	"token_hash" text not null,
	"created_at" timestamp with time zone default now() not null,
	"expires_at" timestamp with time zone not null,
	"consumed_at" timestamp with time zone,
	constraint "password_reset_tokens_token_hash_unique" unique("token_hash")
);

create table "mfa_credentials" (
	"id" uuid primary key not null,
	"user_id" uuid not null,
	"secret_encrypted" text not null,
	"created_at" timestamp with time zone default now() not null,
	"verified_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	constraint "mfa_credentials_user_id_unique" unique("user_id")
);

create table "mfa_backup_codes" (
	"id" uuid primary key not null,
	"user_id" uuid not null,
	"code_hash" text not null,
	"batch_id" uuid not null,
	"created_at" timestamp with time zone default now() not null,
	"used_at" timestamp with time zone
);

create table "mfa_pending_logins" (
	"id" uuid primary key not null,
	"user_id" uuid not null,
	"token_hash" text not null,
	"created_at" timestamp with time zone default now() not null,
	"expires_at" timestamp with time zone not null,
	constraint "mfa_pending_logins_token_hash_unique" unique("token_hash")
);

create table "login_events" (
	"id" uuid primary key not null,
	"user_id" uuid,
	"identifier" text not null,
	"success" boolean not null,
	"failure_reason" text,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone default now() not null
);

create table "rate_limit_buckets" (
	"key" text not null,
	"window_start" timestamp with time zone not null,
	"count" integer default 0 not null,
	constraint "rate_limit_buckets_key_window_start_pk" primary key("key", "window_start")
);

create table "notifications" (
	"id" uuid primary key not null,
	"user_id" uuid not null,
	"type" text not null,
	"payload" jsonb not null,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone default now() not null
);

create table "audit_logs" (
	"id" uuid primary key not null,
	"actor_user_id" uuid,
	"action" text not null,
	"target_type" text not null,
	"target_id" text not null,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"created_at" timestamp with time zone default now() not null,
	"correlation_id" text not null
);

alter table "profiles" add constraint "profiles_user_id_users_id_fk" foreign key ("user_id") references "public"."users"("id") on delete cascade;
alter table "sessions" add constraint "sessions_user_id_users_id_fk" foreign key ("user_id") references "public"."users"("id") on delete cascade;
alter table "trusted_devices" add constraint "trusted_devices_user_id_users_id_fk" foreign key ("user_id") references "public"."users"("id") on delete cascade;
alter table "user_roles" add constraint "user_roles_user_id_users_id_fk" foreign key ("user_id") references "public"."users"("id") on delete cascade;
alter table "user_roles" add constraint "user_roles_role_id_roles_id_fk" foreign key ("role_id") references "public"."roles"("id") on delete cascade;
alter table "user_roles" add constraint "user_roles_granted_by_users_id_fk" foreign key ("granted_by") references "public"."users"("id");
alter table "email_verification_tokens" add constraint "email_verification_tokens_user_id_users_id_fk" foreign key ("user_id") references "public"."users"("id") on delete cascade;
alter table "password_reset_tokens" add constraint "password_reset_tokens_user_id_users_id_fk" foreign key ("user_id") references "public"."users"("id") on delete cascade;
alter table "mfa_credentials" add constraint "mfa_credentials_user_id_users_id_fk" foreign key ("user_id") references "public"."users"("id") on delete cascade;
alter table "mfa_backup_codes" add constraint "mfa_backup_codes_user_id_users_id_fk" foreign key ("user_id") references "public"."users"("id") on delete cascade;
alter table "mfa_pending_logins" add constraint "mfa_pending_logins_user_id_users_id_fk" foreign key ("user_id") references "public"."users"("id") on delete cascade;
alter table "login_events" add constraint "login_events_user_id_users_id_fk" foreign key ("user_id") references "public"."users"("id") on delete cascade;
alter table "notifications" add constraint "notifications_user_id_users_id_fk" foreign key ("user_id") references "public"."users"("id") on delete cascade;
alter table "audit_logs" add constraint "audit_logs_actor_user_id_users_id_fk" foreign key ("actor_user_id") references "public"."users"("id");

-- Postgres does not automatically index foreign key columns — these are
-- all queried by user_id ("this user's sessions/login history/...").
create index "sessions_user_id_idx" on "sessions" ("user_id");
create index "trusted_devices_user_id_idx" on "trusted_devices" ("user_id");
create index "email_verification_tokens_user_id_idx" on "email_verification_tokens" ("user_id");
create index "password_reset_tokens_user_id_idx" on "password_reset_tokens" ("user_id");
create index "mfa_backup_codes_user_id_idx" on "mfa_backup_codes" ("user_id");
create index "mfa_pending_logins_user_id_idx" on "mfa_pending_logins" ("user_id");
create index "login_events_user_id_idx" on "login_events" ("user_id");
create index "notifications_user_id_idx" on "notifications" ("user_id");
create index "audit_logs_actor_user_id_idx" on "audit_logs" ("actor_user_id");

-- Row Level Security: this app connects with the Postgres service-role
-- credential and enforces authorization itself in lib/auth/dal.ts, not
-- via Supabase's PostgREST/anon-key path — but RLS is enabled on every
-- table regardless, as defense-in-depth against ever accidentally
-- exposing these tables through PostgREST with a permissive policy. No
-- policies are defined, so RLS-governed access (anon/authenticated roles)
-- is denied by default; the service role bypasses RLS entirely, which is
-- how this app actually reads and writes.
alter table "users" enable row level security;
alter table "profiles" enable row level security;
alter table "sessions" enable row level security;
alter table "trusted_devices" enable row level security;
alter table "roles" enable row level security;
alter table "user_roles" enable row level security;
alter table "email_verification_tokens" enable row level security;
alter table "password_reset_tokens" enable row level security;
alter table "mfa_credentials" enable row level security;
alter table "mfa_backup_codes" enable row level security;
alter table "mfa_pending_logins" enable row level security;
alter table "login_events" enable row level security;
alter table "rate_limit_buckets" enable row level security;
alter table "notifications" enable row level security;
alter table "audit_logs" enable row level security;
