-- Additive only: track a pending two-party void request on an executed
-- Agreement, and a durable fixed-window rate-limit counter for the public
-- (unauthenticated) mutation routes. No existing column, index, or
-- constraint is altered or dropped, so this is forward-safe.

ALTER TABLE "contracts"
  ADD COLUMN "void_requested_at" TIMESTAMP(3),
  ADD COLUMN "void_requested_by_role" TEXT,
  ADD COLUMN "void_request_note" TEXT,
  ADD COLUMN "void_confirm_note" TEXT;

CREATE TABLE "rate_limit_buckets" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "reset_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rate_limit_buckets_key_key" ON "rate_limit_buckets"("key");
CREATE INDEX "rate_limit_buckets_reset_at_idx" ON "rate_limit_buckets"("reset_at");
