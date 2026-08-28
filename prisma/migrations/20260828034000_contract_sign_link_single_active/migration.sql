-- Preserve every historical link while ensuring only one active signing link
-- can exist for a signer. Any pre-existing duplicates are revoked, never deleted.
BEGIN;

LOCK TABLE "contract_review_links" IN SHARE ROW EXCLUSIVE MODE;

WITH ranked_active_links AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "signer_id"
      ORDER BY "created_at" DESC, "id" DESC
    ) AS active_rank
  FROM "contract_review_links"
  WHERE "type" = 'sign'
    AND "signer_id" IS NOT NULL
    AND "revoked_at" IS NULL
)
UPDATE "contract_review_links" AS link
SET "revoked_at" = CURRENT_TIMESTAMP
FROM ranked_active_links AS ranked
WHERE link."id" = ranked."id"
  AND ranked.active_rank > 1;

CREATE UNIQUE INDEX "contract_review_links_one_active_signer_idx"
ON "contract_review_links" ("signer_id")
WHERE "type" = 'sign'
  AND "signer_id" IS NOT NULL
  AND "revoked_at" IS NULL;

COMMIT;
