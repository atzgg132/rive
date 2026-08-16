-- Production-grade funnel instrumentation: explicit envelope versioning,
-- selective-read indexes, and a best-effort rejection ledger for monitoring.

ALTER TABLE "product_events"
  ADD COLUMN "schema_version" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "product_events_environment_event_name_occurred_at_idx"
  ON "product_events"("environment", "event_name", "occurred_at");
CREATE INDEX "product_events_environment_user_id_occurred_at_idx"
  ON "product_events"("environment", "user_id", "occurred_at");
CREATE INDEX "product_events_environment_data_origin_occurred_at_idx"
  ON "product_events"("environment", "data_origin", "occurred_at");

CREATE TABLE "product_event_issues" (
  "id" TEXT NOT NULL,
  "event_name" TEXT NOT NULL,
  "event_version" INTEGER NOT NULL DEFAULT 1,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "environment" TEXT NOT NULL,
  "user_id" TEXT,
  "anonymous_id" TEXT,
  "request_id" TEXT,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_event_issues_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_event_issues_created_at_idx"
  ON "product_event_issues"("created_at");
CREATE INDEX "product_event_issues_environment_created_at_idx"
  ON "product_event_issues"("environment", "created_at");
CREATE INDEX "product_event_issues_event_name_created_at_idx"
  ON "product_event_issues"("event_name", "created_at");
