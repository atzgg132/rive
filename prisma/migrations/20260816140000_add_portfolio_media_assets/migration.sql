-- Manifest for managed portfolio uploads.
-- Uploads are written straight to object storage by the browser, so this table
-- is the only server-side record of what exists. It backs the per-account
-- storage quota, records the content-signature confirmation, and lets the
-- sweeper remove objects that no portfolio references any more.
CREATE TABLE "portfolio_assets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "portfolio_assets_key_key" ON "portfolio_assets"("key");
CREATE INDEX "portfolio_assets_user_id_status_idx" ON "portfolio_assets"("user_id", "status");
CREATE INDEX "portfolio_assets_status_created_at_idx" ON "portfolio_assets"("status", "created_at");

ALTER TABLE "portfolio_assets" ADD CONSTRAINT "portfolio_assets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
