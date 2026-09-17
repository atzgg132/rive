BEGIN;

CREATE TABLE "contact_messages" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'new',
  "notification_status" TEXT NOT NULL DEFAULT 'queued',
  "notification_error" TEXT,
  "outbox_id" TEXT,
  "ip_hash" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_messages_status_created_at_idx"
ON "contact_messages" ("status", "created_at");

CREATE INDEX "contact_messages_notification_status_created_at_idx"
ON "contact_messages" ("notification_status", "created_at");

CREATE INDEX "contact_messages_email_created_at_idx"
ON "contact_messages" ("email", "created_at");

COMMIT;
