-- Additive persistence for Agreement work setup, proof provenance, and
-- inquiry-led conversion. No historical rows are backfilled or rewritten.

ALTER TABLE "projects"
  ADD COLUMN "completed_at" TIMESTAMP(3),
  ADD COLUMN "source_inquiry_id" TEXT;

ALTER TABLE "tasks"
  ADD COLUMN "source_inquiry_id" TEXT;

ALTER TABLE "portfolio_inquiries"
  ADD COLUMN "source_project_title" TEXT,
  ADD COLUMN "client_id" TEXT,
  ADD COLUMN "attribution_source" TEXT,
  ADD COLUMN "attribution_medium" TEXT,
  ADD COLUMN "attribution_campaign" TEXT,
  ADD COLUMN "attribution_landing_page" TEXT,
  ADD COLUMN "attribution_referral" TEXT,
  ADD COLUMN "converted_at" TIMESTAMP(3);

CREATE TABLE "project_generation_records" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "accepted_version_id" TEXT NOT NULL,
  "project_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "preview_plan" JSONB,
  "preview_hash" TEXT,
  "idempotency_key_hash" TEXT,
  "result_ids" JSONB,
  "error" TEXT,
  "previewed_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_generation_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "projects_source_inquiry_id_key"
  ON "projects"("source_inquiry_id");
CREATE UNIQUE INDEX "tasks_source_inquiry_id_key"
  ON "tasks"("source_inquiry_id");
CREATE UNIQUE INDEX "project_generation_contract_version_key"
  ON "project_generation_records"("contract_id", "accepted_version_id");

CREATE INDEX "portfolio_inquiries_user_id_client_id_created_at_idx"
  ON "portfolio_inquiries"("user_id", "client_id", "created_at");
CREATE INDEX "project_generation_records_user_id_status_updated_at_idx"
  ON "project_generation_records"("user_id", "status", "updated_at");
CREATE INDEX "project_generation_records_contract_id_status_idx"
  ON "project_generation_records"("contract_id", "status");
CREATE INDEX "project_generation_records_project_id_idx"
  ON "project_generation_records"("project_id");

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_source_inquiry_id_fkey"
  FOREIGN KEY ("source_inquiry_id") REFERENCES "portfolio_inquiries"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_source_inquiry_id_fkey"
  FOREIGN KEY ("source_inquiry_id") REFERENCES "portfolio_inquiries"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "portfolio_inquiries"
  ADD CONSTRAINT "portfolio_inquiries_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_generation_records"
  ADD CONSTRAINT "project_generation_records_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_generation_records_contract_id_fkey"
  FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_generation_records_accepted_version_id_fkey"
  FOREIGN KEY ("accepted_version_id") REFERENCES "contract_versions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "project_generation_records_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
