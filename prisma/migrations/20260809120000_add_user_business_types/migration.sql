ALTER TABLE "users" ADD COLUMN "business_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "users"
SET "business_types" = ARRAY["business_type"]::TEXT[]
WHERE "business_type" IS NOT NULL AND "business_type" <> '';
