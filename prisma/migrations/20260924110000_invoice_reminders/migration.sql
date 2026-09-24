BEGIN;

-- AlterTable
ALTER TABLE "invoice_profiles" ADD COLUMN     "paid_receipt_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminder_schedule" TEXT[] DEFAULT ARRAY['due_minus_3', 'due_plus_1', 'due_plus_7', 'due_plus_14']::TEXT[],
ADD COLUMN     "reminders_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminders_prompt_seen_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "reminders_opted_out" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminders_unsubscribe_token_hash" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "paid_receipt_sent_at" TIMESTAMP(3),
ADD COLUMN     "public_token_encrypted" TEXT,
ADD COLUMN     "reminders_paused" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "invoice_reminders" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outbox_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_reminders_invoice_id_idx" ON "invoice_reminders"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_reminders_sent_at_idx" ON "invoice_reminders"("sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_reminders_invoice_id_step_key" ON "invoice_reminders"("invoice_id", "step");

-- CreateIndex
CREATE UNIQUE INDEX "clients_reminders_unsubscribe_token_hash_key" ON "clients"("reminders_unsubscribe_token_hash");

-- AddForeignKey
ALTER TABLE "invoice_reminders" ADD CONSTRAINT "invoice_reminders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
