-- Raise existing per-user invoice sequences to follow generated-format invoice
-- numbers already stored in the database. This intentionally does not change
-- any invoice rows; it only prevents future automatic allocation from
-- starting behind historical, imported, or explicitly numbered invoices.
WITH generated AS (
  SELECT
    i."user_id",
    MAX((((regexp_match(i."invoice_number", '^[A-Za-z0-9-]+-[0-9]{4}-([0-9]{1,10})$'))[1])::bigint)) AS max_number
  FROM "invoices" AS i
  WHERE i."invoice_number" ~ '^[A-Za-z0-9-]+-[0-9]{4}-[0-9]{1,10}$'
  GROUP BY i."user_id"
)
UPDATE "invoice_number_sequences" AS s
SET
  "next_number" = generated.max_number + 1,
  "updated_at" = CURRENT_TIMESTAMP
FROM generated
WHERE s."user_id" = generated."user_id"
  AND generated.max_number <= 2147483646
  AND s."next_number" < generated.max_number + 1;
