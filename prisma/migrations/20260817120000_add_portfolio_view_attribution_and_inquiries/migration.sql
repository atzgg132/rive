-- Portfolio view attribution and durable portfolio inquiries.
--
-- Two changes, both additive:
--
-- 1. portfolio_views gains a page discriminator and a nullable project id, so
--    a case-study read can be told apart from a landing-page read and project
--    popularity becomes measurable. Existing rows keep their meaning: the
--    DEFAULT backfills page_type to 'portfolio' and project_id stays NULL, which
--    is exactly what those rows were — unattributed views of the portfolio.
--    project_id references the identifier inside Portfolio.content, so it
--    deliberately carries no foreign key: deleting or renaming a project must
--    not rewrite history.
--
-- 2. portfolio_inquiries makes a contact-form submission a first-class record
--    instead of a fire-and-forget email. Notification state is tracked
--    separately from the inquiry itself, so a provider outage can never lose a
--    lead. outbox_id correlates to email_outbox without a foreign key, because
--    outbox rows are operational and prunable while inquiries are kept.

ALTER TABLE "portfolio_views"
    ADD COLUMN "page_type" TEXT NOT NULL DEFAULT 'portfolio',
    ADD COLUMN "project_id" TEXT;

CREATE INDEX "portfolio_views_portfolio_id_page_type_viewed_at_idx"
    ON "portfolio_views"("portfolio_id", "page_type", "viewed_at");
CREATE INDEX "portfolio_views_portfolio_id_project_id_viewed_at_idx"
    ON "portfolio_views"("portfolio_id", "project_id", "viewed_at");

CREATE TABLE "portfolio_inquiries" (
    "id" TEXT NOT NULL,
    "portfolio_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_project_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "project_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notification_status" TEXT NOT NULL DEFAULT 'queued',
    "notification_error" TEXT,
    "outbox_id" TEXT,
    "visitor_hash" TEXT,
    "referrer" TEXT,
    "device_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "read_at" TIMESTAMP(3),
    "replied_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "portfolio_inquiries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "portfolio_inquiries_user_id_created_at_idx"
    ON "portfolio_inquiries"("user_id", "created_at");
CREATE INDEX "portfolio_inquiries_user_id_status_created_at_idx"
    ON "portfolio_inquiries"("user_id", "status", "created_at");
CREATE INDEX "portfolio_inquiries_portfolio_id_created_at_idx"
    ON "portfolio_inquiries"("portfolio_id", "created_at");
CREATE INDEX "portfolio_inquiries_portfolio_id_source_project_id_created_at_idx"
    ON "portfolio_inquiries"("portfolio_id", "source_project_id", "created_at");
CREATE INDEX "portfolio_inquiries_outbox_id_idx"
    ON "portfolio_inquiries"("outbox_id");

ALTER TABLE "portfolio_inquiries" ADD CONSTRAINT "portfolio_inquiries_portfolio_id_fkey"
    FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portfolio_inquiries" ADD CONSTRAINT "portfolio_inquiries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
