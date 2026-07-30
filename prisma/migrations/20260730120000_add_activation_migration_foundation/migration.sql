CREATE TABLE "import_jobs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'generic_csv',
  "source_label" TEXT,
  "status" TEXT NOT NULL DEFAULT 'uploaded',
  "phase" TEXT NOT NULL DEFAULT 'analysis',
  "mode" TEXT NOT NULL DEFAULT 'migration',
  "total_rows" INTEGER NOT NULL DEFAULT 0,
  "processed_rows" INTEGER NOT NULL DEFAULT 0,
  "created_records" INTEGER NOT NULL DEFAULT 0,
  "updated_records" INTEGER NOT NULL DEFAULT 0,
  "skipped_records" INTEGER NOT NULL DEFAULT 0,
  "unresolved_count" INTEGER NOT NULL DEFAULT 0,
  "summary" JSONB,
  "error" TEXT,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "rolled_back_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_files" (
  "id" TEXT NOT NULL,
  "import_job_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "row_count" INTEGER NOT NULL,
  "headers" JSONB NOT NULL,
  "sample" JSONB,
  "mapping" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "imported_records" (
  "id" TEXT NOT NULL,
  "import_job_id" TEXT NOT NULL,
  "import_file_id" TEXT,
  "source_row" INTEGER,
  "source_type" TEXT NOT NULL,
  "source_key" TEXT,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "action" TEXT NOT NULL DEFAULT 'created',
  "before" JSONB,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "imported_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_issues" (
  "id" TEXT NOT NULL,
  "import_job_id" TEXT NOT NULL,
  "import_file_id" TEXT,
  "source_row" INTEGER,
  "entity" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'warning',
  "code" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "field" TEXT,
  "source_value" TEXT,
  "candidates" JSONB,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_mappings" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mapping" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "import_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connector_connections" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_account_id" TEXT NOT NULL,
  "account_label" TEXT,
  "encrypted_credentials" TEXT NOT NULL,
  "scopes" TEXT[],
  "status" TEXT NOT NULL DEFAULT 'connected',
  "settings" JSONB,
  "sync_cursor" JSONB,
  "last_synced_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "connector_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sync_runs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "connector_connection_id" TEXT,
  "provider" TEXT NOT NULL,
  "trigger" TEXT NOT NULL DEFAULT 'manual',
  "status" TEXT NOT NULL DEFAULT 'queued',
  "cursor_before" JSONB,
  "cursor_after" JSONB,
  "summary" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_events" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "action" TEXT NOT NULL,
  "target_type" TEXT,
  "target_id" TEXT,
  "metadata" JSONB,
  "ip_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "import_jobs_user_id_created_at_idx" ON "import_jobs"("user_id", "created_at");
CREATE INDEX "import_jobs_user_id_status_created_at_idx" ON "import_jobs"("user_id", "status", "created_at");
CREATE INDEX "import_files_import_job_id_idx" ON "import_files"("import_job_id");
CREATE INDEX "import_files_checksum_idx" ON "import_files"("checksum");
CREATE UNIQUE INDEX "imported_records_import_job_id_source_type_source_key_key" ON "imported_records"("import_job_id", "source_type", "source_key");
CREATE INDEX "imported_records_import_job_id_target_type_idx" ON "imported_records"("import_job_id", "target_type");
CREATE INDEX "imported_records_target_type_target_id_idx" ON "imported_records"("target_type", "target_id");
CREATE INDEX "import_issues_import_job_id_severity_idx" ON "import_issues"("import_job_id", "severity");
CREATE INDEX "import_issues_import_job_id_resolved_at_idx" ON "import_issues"("import_job_id", "resolved_at");
CREATE UNIQUE INDEX "import_mappings_user_id_provider_entity_name_key" ON "import_mappings"("user_id", "provider", "entity", "name");
CREATE INDEX "import_mappings_user_id_provider_idx" ON "import_mappings"("user_id", "provider");
CREATE UNIQUE INDEX "connector_connections_user_id_provider_provider_account_id_key" ON "connector_connections"("user_id", "provider", "provider_account_id");
CREATE INDEX "connector_connections_user_id_provider_status_idx" ON "connector_connections"("user_id", "provider", "status");
CREATE INDEX "sync_runs_user_id_provider_created_at_idx" ON "sync_runs"("user_id", "provider", "created_at");
CREATE INDEX "sync_runs_status_created_at_idx" ON "sync_runs"("status", "created_at");
CREATE INDEX "audit_events_user_id_created_at_idx" ON "audit_events"("user_id", "created_at");
CREATE INDEX "audit_events_action_created_at_idx" ON "audit_events"("action", "created_at");

ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_files" ADD CONSTRAINT "import_files_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imported_records" ADD CONSTRAINT "imported_records_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "imported_records" ADD CONSTRAINT "imported_records_import_file_id_fkey" FOREIGN KEY ("import_file_id") REFERENCES "import_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "import_issues" ADD CONSTRAINT "import_issues_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_issues" ADD CONSTRAINT "import_issues_import_file_id_fkey" FOREIGN KEY ("import_file_id") REFERENCES "import_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "import_mappings" ADD CONSTRAINT "import_mappings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connector_connections" ADD CONSTRAINT "connector_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_connector_connection_id_fkey" FOREIGN KEY ("connector_connection_id") REFERENCES "connector_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
