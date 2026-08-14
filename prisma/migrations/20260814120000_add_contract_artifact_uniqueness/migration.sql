-- One artifact per (contract, version, type) — e.g. a single evidence PDF per
-- accepted version. Defense-in-depth: correctness currently rests on the
-- optimistic signing → executed transaction ordering; this makes a duplicate
-- artifact write impossible even if that ordering ever races.
-- Additive only: creates an index, touches no rows.

-- CreateIndex
CREATE UNIQUE INDEX "contract_artifacts_contract_id_version_id_artifact_type_key" ON "contract_artifacts"("contract_id", "version_id", "artifact_type");
