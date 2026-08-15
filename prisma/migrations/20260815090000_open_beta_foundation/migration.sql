-- Open beta foundation: verified signup, durable email work, first-party
-- product events, acquisition attribution, feedback, and secure admin sessions.

ALTER TABLE "users"
  ADD COLUMN "email_verified_at" TIMESTAMP(3),
  ADD COLUMN "email_verification_required_at" TIMESTAMP(3),
  ADD COLUMN "account_type" TEXT NOT NULL DEFAULT 'customer';

ALTER TABLE "page_views"
  ADD COLUMN "referrer_domain" TEXT,
  ADD COLUMN "anonymous_id" TEXT,
  ADD COLUMN "session_id" TEXT,
  ADD COLUMN "user_id" TEXT,
  ADD COLUMN "utm_source" TEXT,
  ADD COLUMN "utm_medium" TEXT,
  ADD COLUMN "utm_campaign" TEXT,
  ADD COLUMN "landing_path" TEXT;

ALTER TABLE "page_views"
  ADD CONSTRAINT "page_views_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "page_views_anonymous_id_visited_at_idx" ON "page_views"("anonymous_id", "visited_at");
CREATE INDEX "page_views_user_id_visited_at_idx" ON "page_views"("user_id", "visited_at");
CREATE INDEX "page_views_utm_source_visited_at_idx" ON "page_views"("utm_source", "visited_at");

CREATE TABLE "email_outbox" (
  "id" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "encrypted_payload" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error" TEXT,
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "email_outbox_status_available_at_idx" ON "email_outbox"("status", "available_at");
CREATE INDEX "email_outbox_recipient_type_created_at_idx" ON "email_outbox"("recipient", "type", "created_at");

CREATE TABLE "admin_sessions" (
  "id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "last_seen_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "ip_hash" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");
CREATE INDEX "admin_sessions_expires_at_revoked_at_idx" ON "admin_sessions"("expires_at", "revoked_at");

CREATE TABLE "user_attributions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "first_touch_source" TEXT,
  "first_touch_medium" TEXT,
  "first_touch_campaign" TEXT,
  "first_touch_referrer" TEXT,
  "first_touch_landing_page" TEXT,
  "last_touch_source" TEXT,
  "last_touch_medium" TEXT,
  "last_touch_campaign" TEXT,
  "last_touch_referrer" TEXT,
  "last_touch_landing_page" TEXT,
  "referral_source" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_attributions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_attributions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "user_attributions_user_id_key" ON "user_attributions"("user_id");
CREATE INDEX "user_attributions_first_touch_source_created_at_idx" ON "user_attributions"("first_touch_source", "created_at");
CREATE INDEX "user_attributions_last_touch_source_created_at_idx" ON "user_attributions"("last_touch_source", "created_at");

CREATE TABLE "product_events" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "anonymous_id" TEXT,
  "session_id" TEXT,
  "event_name" TEXT NOT NULL,
  "event_version" INTEGER NOT NULL DEFAULT 1,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "environment" TEXT NOT NULL DEFAULT 'local',
  "module" TEXT,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "data_origin" TEXT,
  "source" TEXT,
  "request_id" TEXT,
  "dedupe_key" TEXT,
  "properties" JSONB,
  CONSTRAINT "product_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "product_events_dedupe_key_key" ON "product_events"("dedupe_key");
CREATE INDEX "product_events_user_id_occurred_at_idx" ON "product_events"("user_id", "occurred_at");
CREATE INDEX "product_events_anonymous_id_occurred_at_idx" ON "product_events"("anonymous_id", "occurred_at");
CREATE INDEX "product_events_event_name_occurred_at_idx" ON "product_events"("event_name", "occurred_at");
CREATE INDEX "product_events_environment_occurred_at_idx" ON "product_events"("environment", "occurred_at");
CREATE INDEX "product_events_module_occurred_at_idx" ON "product_events"("module", "occurred_at");

CREATE TABLE "feedback" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "anonymous_id" TEXT,
  "prompt_key" TEXT,
  "feedback_type" TEXT NOT NULL DEFAULT 'general',
  "module" TEXT,
  "trigger_event" TEXT,
  "rating" INTEGER,
  "body" TEXT,
  "contact_allowed" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'new',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "context" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feedback_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "feedback_created_at_idx" ON "feedback"("created_at");
CREATE INDEX "feedback_status_created_at_idx" ON "feedback"("status", "created_at");
CREATE INDEX "feedback_user_id_created_at_idx" ON "feedback"("user_id", "created_at");
CREATE INDEX "feedback_module_created_at_idx" ON "feedback"("module", "created_at");

CREATE TABLE "feedback_prompt_states" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "prompt_key" TEXT NOT NULL,
  "shown_at" TIMESTAMP(3),
  "dismissed_at" TIMESTAMP(3),
  "snoozed_until" TIMESTAMP(3),
  "responded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feedback_prompt_states_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feedback_prompt_states_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "feedback_prompt_states_user_id_prompt_key_key" ON "feedback_prompt_states"("user_id", "prompt_key");
CREATE INDEX "feedback_prompt_states_user_id_snoozed_until_idx" ON "feedback_prompt_states"("user_id", "snoozed_until");

