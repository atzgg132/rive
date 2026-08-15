-- Hardening for open-beta measurement and repeatable invoice operations.

ALTER TABLE "calendar_events"
  ADD COLUMN "data_origin" TEXT;

-- Existing native and connector rows are genuine records. This backfill keeps
-- the real-data and activation cohorts from silently losing historical usage.
UPDATE "calendar_events"
SET "data_origin" = CASE
  WHEN "source" IN ('google', 'external_readonly') THEN 'imported'
  ELSE 'user'
END
WHERE "data_origin" IS NULL;

CREATE INDEX "calendar_events_user_id_data_origin_created_at_idx"
  ON "calendar_events"("user_id", "data_origin", "created_at");

ALTER TABLE "invoices"
  ADD COLUMN "discount_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "invoice_payments"
  ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "invoice_payments_invoice_id_idempotency_key_key"
  ON "invoice_payments"("invoice_id", "idempotency_key");
