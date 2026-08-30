import { connectorCredentialConfigured } from "@/utils/connectorConfig";

/**
 * Feature gate for the migration engine.
 *
 * Follows the repository's existing `X_ENABLED` convention so the new
 * experience can be validated in staging and switched off without a deploy.
 * While it is off the original onboarding importer remains the only import
 * path. SSM owns the switch so an operator kill survives Terraform applies.
 */
export function migrationEngineAvailable(): boolean {
  return process.env.MIGRATION_ENGINE_ENABLED?.trim().toLowerCase() === "true";
}

/**
 * Upload ceiling, honouring the platform-wide `MAX_UPLOAD_BYTES` when it is
 * configured so migration cannot accept something the storage tier rejects.
 */
export function maxUploadBytes(): number {
  const configured = Number.parseInt(process.env.MAX_UPLOAD_BYTES || "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : 10 * 1024 * 1024;
}

export { connectorCredentialConfigured };
