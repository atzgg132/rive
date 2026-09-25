BEGIN;

ALTER TABLE "users"
  ADD COLUMN "login_alerts_enabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "invoice_profiles"
  ADD COLUMN "default_payment_terms_days" INTEGER;

-- Settings introduces a single workspace default currency (users.currency),
-- used by projects, invoices, agreements, expenses, and imports. Some users
-- previously set a different default only on their invoice profile
-- (invoice_profiles.default_currency), which nothing else read. Backfill
-- users.currency from that value so those workspaces keep behaving the way
-- their invoices already did, but only when the workspace default is still
-- at the factory default ('USD') — an explicit non-USD users.currency always
-- wins and is left untouched. invoice_profiles.default_currency is kept
-- (not dropped) but is no longer read or written after this migration.
UPDATE "users" AS u
SET "currency" = ip."default_currency"
FROM "invoice_profiles" AS ip
WHERE ip."user_id" = u."id"
  AND ip."default_currency" <> 'USD'
  AND u."currency" = 'USD';

COMMIT;
