-- AlterTable
ALTER TABLE "users" ADD COLUMN     "weekly_summary_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weekly_summary_last_sent_at" TIMESTAMP(3);
