-- Additive persistence for durable uploads, asynchronous progress, recovery,
-- and non-destructive staged-record superseding. This migration intentionally
-- contains no DELETE, DROP, TRUNCATE, or destructive data rewrite.

ALTER TABLE "import_jobs"
  ADD COLUMN "input_revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "progress_completed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "progress_total" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failure_phase" TEXT,
  ADD COLUMN "failure_code" TEXT,
  ADD COLUMN "last_heartbeat_at" TIMESTAMP(3),
  ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "worker_lease_id" TEXT,
  ADD COLUMN "worker_lease_expires_at" TIMESTAMP(3),
  ADD COLUMN "support_requested_at" TIMESTAMP(3);

ALTER TABLE "import_files"
  ADD COLUMN "object_key" TEXT,
  ADD COLUMN "upload_status" TEXT NOT NULL DEFAULT 'verified',
  ADD COLUMN "uploaded_at" TIMESTAMP(3),
  ADD COLUMN "expires_at" TIMESTAMP(3),
  ADD COLUMN "upload_error" TEXT;

ALTER TABLE "migration_records"
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "import_mappings"
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "migration_records_import_job_id_active_entity_status_idx"
  ON "migration_records"("import_job_id", "active", "entity", "status");

CREATE INDEX "import_mappings_user_id_active_updated_at_idx"
  ON "import_mappings"("user_id", "active", "updated_at");
