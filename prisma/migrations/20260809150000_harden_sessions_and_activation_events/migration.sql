ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;

DELETE FROM "audit_events" AS duplicate
USING "audit_events" AS keeper
WHERE duplicate."user_id" IS NOT NULL
  AND duplicate."user_id" = keeper."user_id"
  AND duplicate."action" = keeper."action"
  AND (
    duplicate."created_at" > keeper."created_at"
    OR (duplicate."created_at" = keeper."created_at" AND duplicate."id" > keeper."id")
  );

CREATE UNIQUE INDEX "audit_events_user_id_action_key" ON "audit_events"("user_id", "action");
