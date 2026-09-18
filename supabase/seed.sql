-- Runs automatically after `supabase db reset` / on first `supabase start`.
-- Also applied to the separate mktrading_test database by
-- lib/db/test-global-setup.ts, so both databases share one seed source.
insert into "roles" ("id", "name", "description")
values
  (gen_random_uuid(), 'USER', 'Standard trading account.'),
  (gen_random_uuid(), 'SUPER_ADMIN', 'Full administrative access.'),
  (gen_random_uuid(), 'FINANCE_ADMIN', 'Treasury and withdrawal approval authority.'),
  (gen_random_uuid(), 'COMPLIANCE_ADMIN', 'KYC and compliance review authority.'),
  (gen_random_uuid(), 'OPERATIONS_ADMIN', 'Day-to-day platform operations authority.'),
  (gen_random_uuid(), 'RISK_ADMIN', 'Risk monitoring and account restriction authority.')
on conflict ("name") do nothing;
