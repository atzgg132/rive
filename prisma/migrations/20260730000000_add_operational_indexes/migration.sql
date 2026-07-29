-- Indexes for the high-frequency workspace, reporting, and maintenance queries.
-- This migration is data-preserving and can be rolled out independently.

CREATE INDEX "waitlist_status_created_at_idx" ON "waitlist"("status", "created_at");
CREATE INDEX "page_views_visited_at_idx" ON "page_views"("visited_at");
CREATE INDEX "email_deliveries_status_created_at_idx" ON "email_deliveries"("status", "created_at");

CREATE INDEX "clients_user_id_created_at_idx" ON "clients"("user_id", "created_at");
CREATE INDEX "clients_user_id_status_idx" ON "clients"("user_id", "status");

CREATE INDEX "projects_user_id_created_at_idx" ON "projects"("user_id", "created_at");
CREATE INDEX "projects_user_id_status_due_date_idx" ON "projects"("user_id", "status", "due_date");
CREATE INDEX "projects_client_id_idx" ON "projects"("client_id");

CREATE INDEX "milestones_project_id_due_date_idx" ON "milestones"("project_id", "due_date");

CREATE INDEX "invoices_user_id_created_at_idx" ON "invoices"("user_id", "created_at");
CREATE INDEX "invoices_user_id_status_due_date_idx" ON "invoices"("user_id", "status", "due_date");
CREATE INDEX "invoices_user_id_status_issue_date_idx" ON "invoices"("user_id", "status", "issue_date");
CREATE INDEX "invoices_client_id_idx" ON "invoices"("client_id");
CREATE INDEX "invoices_project_id_idx" ON "invoices"("project_id");
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

CREATE INDEX "expenses_user_id_date_idx" ON "expenses"("user_id", "date");
CREATE INDEX "expenses_user_id_created_at_idx" ON "expenses"("user_id", "created_at");
CREATE INDEX "expenses_user_id_category_idx" ON "expenses"("user_id", "category");
CREATE INDEX "expenses_project_id_idx" ON "expenses"("project_id");
