import { notFound } from "next/navigation";
import { migrationEngineAvailable } from "@/utils/migration/config";
import { MIGRATION_LIMITS } from "@/lib/migration/config";
import MigrationWizard from "./MigrationWizard";

/**
 * The migration experience.
 *
 * Gated server-side: while the flag is off the route does not exist, so the
 * original onboarding importer stays the single, unambiguous import path.
 */
export const dynamic = "force-dynamic";

export default function MigratePage() {
  if (!migrationEngineAvailable()) notFound();

  return (
    <MigrationWizard
      limits={{
        maxFiles: MIGRATION_LIMITS.maxFiles,
        maxRows: MIGRATION_LIMITS.maxTotalRows,
        maxFileMb: Math.round(MIGRATION_LIMITS.maxFileBytes / (1024 * 1024)),
      }}
    />
  );
}
