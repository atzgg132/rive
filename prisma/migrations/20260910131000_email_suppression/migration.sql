BEGIN;

CREATE TABLE "email_suppressions" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'ses',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_suppressions_email_key"
ON "email_suppressions" ("email");

CREATE INDEX "email_suppressions_created_at_idx"
ON "email_suppressions" ("created_at");

COMMIT;
