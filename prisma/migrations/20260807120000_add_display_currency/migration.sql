ALTER TABLE "users"
ADD COLUMN "display_currency" TEXT NOT NULL DEFAULT 'USD';

UPDATE "users"
SET "display_currency" = UPPER("currency")
WHERE UPPER("currency") IN ('USD', 'INR', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'JPY', 'CHF', 'NZD', 'CNY', 'HKD');
