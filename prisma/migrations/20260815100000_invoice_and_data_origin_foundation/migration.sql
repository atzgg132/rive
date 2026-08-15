-- Invoice/revenue foundation: explicit record origin, immutable sent snapshots,
-- concurrency-safe numbering, payment history, and invoice activity history.

ALTER TABLE "clients" ADD COLUMN "data_origin" TEXT;
ALTER TABLE "projects" ADD COLUMN "data_origin" TEXT;
ALTER TABLE "expenses" ADD COLUMN "data_origin" TEXT;
ALTER TABLE "invoices"
  ADD COLUMN "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "public_token_hash" TEXT,
  ADD COLUMN "sent_snapshot" JSONB,
  ADD COLUMN "sent_snapshot_at" TIMESTAMP(3),
  ADD COLUMN "viewed_at" TIMESTAMP(3),
  ADD COLUMN "voided_at" TIMESTAMP(3),
  ADD COLUMN "data_origin" TEXT;

-- Preserve the meaning of legacy invoices when introducing the payment ledger.
UPDATE "invoices"
SET "amount_paid" = "total"
WHERE "status" = 'paid' AND "amount_paid" = 0;

CREATE UNIQUE INDEX "invoices_public_token_hash_key" ON "invoices"("public_token_hash");

CREATE TABLE "invoice_profiles" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "business_name" TEXT,
  "contact_name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "tax_id" TEXT,
  "logo_url" TEXT,
  "default_currency" TEXT NOT NULL DEFAULT 'USD',
  "invoice_prefix" TEXT NOT NULL DEFAULT 'INV',
  "payment_instructions" TEXT,
  "default_terms" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invoice_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "invoice_profiles_user_id_key" ON "invoice_profiles"("user_id");

CREATE TABLE "invoice_number_sequences" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "prefix" TEXT NOT NULL DEFAULT 'INV',
  "next_number" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invoice_number_sequences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_number_sequences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "invoice_number_sequences_user_id_key" ON "invoice_number_sequences"("user_id");

CREATE TABLE "invoice_payments" (
  "id" TEXT NOT NULL,
  "invoice_id" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "method" TEXT NOT NULL DEFAULT 'manual',
  "reference" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_payments_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "invoice_payments_invoice_id_paid_at_idx" ON "invoice_payments"("invoice_id", "paid_at");

CREATE TABLE "invoice_events" (
  "id" TEXT NOT NULL,
  "invoice_id" TEXT NOT NULL,
  "user_id" TEXT,
  "event_type" TEXT NOT NULL,
  "metadata" JSONB,
  "ip_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_events_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "invoice_events_invoice_id_created_at_idx" ON "invoice_events"("invoice_id", "created_at");
CREATE INDEX "invoice_events_event_type_created_at_idx" ON "invoice_events"("event_type", "created_at");
