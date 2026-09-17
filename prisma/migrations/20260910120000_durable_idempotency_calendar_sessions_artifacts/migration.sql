BEGIN;

CREATE TABLE "idempotency_records" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "key_hash" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'processing',
  "response" JSONB,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "idempotency_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "idempotency_records_user_id_operation_key_hash_key"
ON "idempotency_records" ("user_id", "operation", "key_hash");

CREATE INDEX "idempotency_records_expires_at_idx"
ON "idempotency_records" ("expires_at");

ALTER TABLE "calendar_sync_outbox"
  ADD COLUMN "claimed_at" TIMESTAMP(3),
  ADD COLUMN "lease_id" TEXT,
  ADD COLUMN "lease_expires_at" TIMESTAMP(3),
  ADD COLUMN "last_result" TEXT;

CREATE INDEX "calendar_sync_outbox_status_lease_expires_at_idx"
ON "calendar_sync_outbox" ("status", "lease_expires_at");

CREATE TABLE "contract_public_sessions" (
  "id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "version_id" TEXT,
  "link_id" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "last_accessed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_public_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_public_sessions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "contract_public_sessions_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "contract_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "contract_public_sessions_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "contract_review_links" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "contract_public_sessions_token_hash_key"
ON "contract_public_sessions" ("token_hash");

CREATE INDEX "contract_public_sessions_link_id_purpose_idx"
ON "contract_public_sessions" ("link_id", "purpose");

CREATE INDEX "contract_public_sessions_expires_at_idx"
ON "contract_public_sessions" ("expires_at");

ALTER TABLE "contract_artifacts"
  ADD COLUMN "storage" TEXT NOT NULL DEFAULT 'inline',
  ADD COLUMN "content_bytes" BYTEA,
  ADD COLUMN "byte_size" INTEGER,
  ADD COLUMN "renderer_version" TEXT;

-- The (contract_id, version_id, artifact_type) unique index already exists as
-- "contract_artifacts_contract_id_version_id_artifact_type_key" since 2026-08-14;
-- creating a second copy under a different name would only double the write cost.

CREATE OR REPLACE FUNCTION "prevent_accepted_contract_evidence_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Accepted contract evidence is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "prevent_executed_contract_version_mutation"()
RETURNS TRIGGER AS $$
DECLARE
  contract_status TEXT;
BEGIN
  SELECT "status" INTO contract_status
  FROM "contracts"
  WHERE "id" = OLD."contract_id";

  IF contract_status = 'executed' THEN
    RAISE EXCEPTION 'Accepted contract versions are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "contract_artifacts_immutable"
BEFORE UPDATE OR DELETE ON "contract_artifacts"
FOR EACH ROW EXECUTE FUNCTION "prevent_accepted_contract_evidence_mutation"();

CREATE TRIGGER "contract_signatures_immutable"
BEFORE UPDATE OR DELETE ON "contract_signatures"
FOR EACH ROW EXECUTE FUNCTION "prevent_accepted_contract_evidence_mutation"();

CREATE TRIGGER "contract_events_append_only"
BEFORE UPDATE OR DELETE ON "contract_events"
FOR EACH ROW EXECUTE FUNCTION "prevent_accepted_contract_evidence_mutation"();

CREATE TRIGGER "executed_contract_versions_immutable"
BEFORE UPDATE OR DELETE ON "contract_versions"
FOR EACH ROW EXECUTE FUNCTION "prevent_executed_contract_version_mutation"();

COMMIT;
