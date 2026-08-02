ALTER TABLE "projects"
  ADD COLUMN "contract_coverage" TEXT NOT NULL DEFAULT 'undecided',
  ADD COLUMN "external_contract_label" TEXT,
  ADD COLUMN "external_contract_url" TEXT,
  ADD COLUMN "contract_decision_at" TIMESTAMP(3);

UPDATE "projects" AS project
SET
  "contract_coverage" = 'rive',
  "contract_decision_at" = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM "contracts" AS contract
  WHERE contract."project_id" = project."id"
    AND contract."status" <> 'void'
);

CREATE INDEX "projects_user_id_contract_coverage_idx"
  ON "projects"("user_id", "contract_coverage");
