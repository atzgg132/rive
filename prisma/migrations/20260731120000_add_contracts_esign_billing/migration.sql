ALTER TABLE "invoices"
  ADD COLUMN "sent_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_at" TIMESTAMP(3);

CREATE TABLE "contracts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "project_id" TEXT,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "provider" TEXT NOT NULL DEFAULT 'local',
  "provider_envelope_id" TEXT,
  "governing_law" TEXT NOT NULL DEFAULT 'India',
  "jurisdiction" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "review_expires_at" TIMESTAMP(3),
  "finalized_at" TIMESTAMP(3),
  "executed_at" TIMESTAMP(3),
  "voided_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract_versions" (
  "id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "content" JSONB NOT NULL,
  "content_hash" TEXT NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalized_at" TIMESTAMP(3),
  CONSTRAINT "contract_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract_signers" (
  "id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "user_id" TEXT,
  "client_id" TEXT,
  "role" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "provider_signer_id" TEXT,
  "invited_at" TIMESTAMP(3),
  "signed_at" TIMESTAMP(3),
  "declined_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_signers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract_signatures" (
  "id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "version_id" TEXT NOT NULL,
  "signer_id" TEXT NOT NULL,
  "signer_role" TEXT NOT NULL,
  "signer_name" TEXT NOT NULL,
  "signer_email" TEXT NOT NULL,
  "signature_type" TEXT NOT NULL DEFAULT 'typed',
  "signature_value" TEXT,
  "consent_accepted" BOOLEAN NOT NULL,
  "consent_text_version" TEXT NOT NULL,
  "ip_hash" TEXT,
  "user_agent_hash" TEXT,
  "provider_event_id" TEXT,
  "provider_payload" JSONB,
  "signed_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_signatures_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract_review_links" (
  "id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "version_id" TEXT,
  "signer_id" TEXT,
  "token_hash" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'review',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "last_accessed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_review_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract_comments" (
  "id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "version_id" TEXT,
  "review_link_id" TEXT,
  "author_user_id" TEXT,
  "author_role" TEXT NOT NULL,
  "author_name" TEXT NOT NULL,
  "author_email" TEXT,
  "section_key" TEXT,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract_events" (
  "id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "version_id" TEXT,
  "actor_user_id" TEXT,
  "event_type" TEXT NOT NULL,
  "metadata" JSONB,
  "ip_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract_artifacts" (
  "id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "version_id" TEXT NOT NULL,
  "artifact_type" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "object_key" TEXT,
  "content" JSONB,
  "content_hash" TEXT NOT NULL,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract_payment_plan_items" (
  "id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "milestone_id" TEXT,
  "label" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "trigger_type" TEXT NOT NULL,
  "trigger_date" TIMESTAMP(3),
  "due_days" INTEGER NOT NULL DEFAULT 7,
  "invoice_description" TEXT,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_payment_plan_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract_billing_occurrences" (
  "id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "payment_plan_item_id" TEXT NOT NULL,
  "invoice_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "eligible_at" TIMESTAMP(3),
  "drafted_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_billing_occurrences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_deliveries" (
  "id" TEXT NOT NULL,
  "invoice_id" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'email',
  "status" TEXT NOT NULL,
  "provider_message_id" TEXT,
  "error" TEXT,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "href" TEXT,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contract_versions_contract_id_version_key" ON "contract_versions"("contract_id", "version");
CREATE UNIQUE INDEX "contract_signers_contract_id_role_key" ON "contract_signers"("contract_id", "role");
CREATE UNIQUE INDEX "contract_signatures_signer_id_version_id_key" ON "contract_signatures"("signer_id", "version_id");
CREATE UNIQUE INDEX "contract_review_links_token_hash_key" ON "contract_review_links"("token_hash");
CREATE UNIQUE INDEX "contract_billing_occurrences_payment_plan_item_id_key" ON "contract_billing_occurrences"("payment_plan_item_id");
CREATE UNIQUE INDEX "contract_billing_occurrences_invoice_id_key" ON "contract_billing_occurrences"("invoice_id");

CREATE INDEX "contracts_user_id_status_updated_at_idx" ON "contracts"("user_id", "status", "updated_at");
CREATE INDEX "contracts_client_id_status_idx" ON "contracts"("client_id", "status");
CREATE INDEX "contracts_project_id_idx" ON "contracts"("project_id");
CREATE INDEX "contract_versions_contract_id_status_idx" ON "contract_versions"("contract_id", "status");
CREATE INDEX "contract_signers_email_status_idx" ON "contract_signers"("email", "status");
CREATE INDEX "contract_signatures_contract_id_signed_at_idx" ON "contract_signatures"("contract_id", "signed_at");
CREATE INDEX "contract_review_links_contract_id_type_revoked_at_idx" ON "contract_review_links"("contract_id", "type", "revoked_at");
CREATE INDEX "contract_review_links_version_id_type_idx" ON "contract_review_links"("version_id", "type");
CREATE INDEX "contract_review_links_expires_at_idx" ON "contract_review_links"("expires_at");
CREATE INDEX "contract_comments_contract_id_status_created_at_idx" ON "contract_comments"("contract_id", "status", "created_at");
CREATE INDEX "contract_comments_version_id_section_key_idx" ON "contract_comments"("version_id", "section_key");
CREATE INDEX "contract_events_contract_id_created_at_idx" ON "contract_events"("contract_id", "created_at");
CREATE INDEX "contract_events_event_type_created_at_idx" ON "contract_events"("event_type", "created_at");
CREATE INDEX "contract_artifacts_contract_id_generated_at_idx" ON "contract_artifacts"("contract_id", "generated_at");
CREATE INDEX "contract_payment_plan_items_contract_id_status_sequence_idx" ON "contract_payment_plan_items"("contract_id", "status", "sequence");
CREATE INDEX "contract_payment_plan_items_milestone_id_trigger_type_idx" ON "contract_payment_plan_items"("milestone_id", "trigger_type");
CREATE INDEX "contract_billing_occurrences_contract_id_status_eligible_at_idx" ON "contract_billing_occurrences"("contract_id", "status", "eligible_at");
CREATE INDEX "invoice_deliveries_invoice_id_created_at_idx" ON "invoice_deliveries"("invoice_id", "created_at");
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

ALTER TABLE "contracts" ADD CONSTRAINT "contracts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_signers" ADD CONSTRAINT "contract_signers_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_signers" ADD CONSTRAINT "contract_signers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract_signers" ADD CONSTRAINT "contract_signers_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract_signatures" ADD CONSTRAINT "contract_signatures_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_signatures" ADD CONSTRAINT "contract_signatures_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "contract_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_signatures" ADD CONSTRAINT "contract_signatures_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "contract_signers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_review_links" ADD CONSTRAINT "contract_review_links_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_review_links" ADD CONSTRAINT "contract_review_links_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "contract_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_review_links" ADD CONSTRAINT "contract_review_links_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "contract_signers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_comments" ADD CONSTRAINT "contract_comments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_comments" ADD CONSTRAINT "contract_comments_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "contract_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract_comments" ADD CONSTRAINT "contract_comments_review_link_id_fkey" FOREIGN KEY ("review_link_id") REFERENCES "contract_review_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract_comments" ADD CONSTRAINT "contract_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract_events" ADD CONSTRAINT "contract_events_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_events" ADD CONSTRAINT "contract_events_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "contract_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract_events" ADD CONSTRAINT "contract_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract_artifacts" ADD CONSTRAINT "contract_artifacts_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_artifacts" ADD CONSTRAINT "contract_artifacts_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "contract_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contract_payment_plan_items" ADD CONSTRAINT "contract_payment_plan_items_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_payment_plan_items" ADD CONSTRAINT "contract_payment_plan_items_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract_billing_occurrences" ADD CONSTRAINT "contract_billing_occurrences_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_billing_occurrences" ADD CONSTRAINT "contract_billing_occurrences_payment_plan_item_id_fkey" FOREIGN KEY ("payment_plan_item_id") REFERENCES "contract_payment_plan_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract_billing_occurrences" ADD CONSTRAINT "contract_billing_occurrences_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoice_deliveries" ADD CONSTRAINT "invoice_deliveries_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
