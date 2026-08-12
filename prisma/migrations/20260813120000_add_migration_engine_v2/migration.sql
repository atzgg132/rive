-- Migration Engine V1 (schema v2)
--
-- Purpose: give the migration pipeline a persisted intermediate representation
-- and an execution ledger, so an import can be previewed, resumed, committed
-- idempotently, and rolled back.
--
-- Safety notes:
--   * Additive only. Every new column is nullable or carries a default, and no
--     existing column, index, or constraint is altered or dropped, so this is
--     forward-safe against a running deployment.
--   * `import_jobs.engine_version` defaults to 1, which correctly labels every
--     pre-existing row as having come from the original onboarding importer.
--     The migration engine writes 2.
--   * `migration_records` and `migration_operations` cascade from
--     `import_jobs`, which itself cascades from `users`, so tenant deletion
--     stays complete.
--   * `imported_records.target_stamp` records the created row's `updated_at` at
--     import time. Rollback uses it to distinguish "untouched since import"
--     from "edited since", and refuses to delete the latter.
-- AlterTable
ALTER TABLE "import_jobs" ADD COLUMN     "default_currency" TEXT,
ADD COLUMN     "engine_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "plan" JSONB,
ADD COLUMN     "plan_hash" TEXT,
ADD COLUMN     "plan_version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "import_files" ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "delimiter" TEXT,
ADD COLUMN     "encoding" TEXT,
ADD COLUMN     "header_row" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "overrides" JSONB,
ADD COLUMN     "profile" JSONB,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "rows" JSONB,
ADD COLUMN     "sheet_name" TEXT,
ADD COLUMN     "source_id" TEXT;

-- AlterTable
ALTER TABLE "imported_records" ADD COLUMN     "target_stamp" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "migration_records" (
    "id" TEXT NOT NULL,
    "import_job_id" TEXT NOT NULL,
    "import_file_id" TEXT,
    "entity" TEXT NOT NULL,
    "source_row" INTEGER NOT NULL,
    "source_key" TEXT NOT NULL,
    "external_id" TEXT,
    "raw" JSONB NOT NULL,
    "normalized" JSONB NOT NULL,
    "field_mappings" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warnings" JSONB NOT NULL,
    "errors" JSONB NOT NULL,
    "relationship_candidates" JSONB NOT NULL,
    "resolved_relationships" JSONB NOT NULL,
    "duplicate_candidates" JSONB NOT NULL,
    "group_key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "action" TEXT NOT NULL DEFAULT 'create',
    "target_type" TEXT,
    "target_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "migration_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_operations" (
    "id" TEXT NOT NULL,
    "import_job_id" TEXT NOT NULL,
    "operation_key" TEXT NOT NULL,
    "plan_hash" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "batch" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "source_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "target_type" TEXT,
    "target_id" TEXT,
    "error" TEXT,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "import_job_id" TEXT,
    "event" TEXT NOT NULL,
    "properties" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "migration_records_import_job_id_entity_status_idx" ON "migration_records"("import_job_id", "entity", "status");

-- CreateIndex
CREATE INDEX "migration_records_import_job_id_group_key_idx" ON "migration_records"("import_job_id", "group_key");

-- CreateIndex
CREATE UNIQUE INDEX "migration_records_import_job_id_source_key_key" ON "migration_records"("import_job_id", "source_key");

-- CreateIndex
CREATE INDEX "migration_operations_import_job_id_status_sequence_idx" ON "migration_operations"("import_job_id", "status", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "migration_operations_import_job_id_operation_key_key" ON "migration_operations"("import_job_id", "operation_key");

-- CreateIndex
CREATE INDEX "migration_events_user_id_created_at_idx" ON "migration_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "migration_events_event_created_at_idx" ON "migration_events"("event", "created_at");

-- CreateIndex
CREATE INDEX "migration_events_import_job_id_created_at_idx" ON "migration_events"("import_job_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "import_files_import_job_id_source_id_key" ON "import_files"("import_job_id", "source_id");

-- AddForeignKey
ALTER TABLE "migration_records" ADD CONSTRAINT "migration_records_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_records" ADD CONSTRAINT "migration_records_import_file_id_fkey" FOREIGN KEY ("import_file_id") REFERENCES "import_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_operations" ADD CONSTRAINT "migration_operations_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_events" ADD CONSTRAINT "migration_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
