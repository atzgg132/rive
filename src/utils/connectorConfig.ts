export function connectorCredentialConfigured(value: string | undefined): value is string {
  return Boolean(value && value.trim() && value.trim().toUpperCase() !== "UNCONFIGURED");
}

function connectorFeatureEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

// Both connectors encrypt stored OAuth credentials with CALENDAR_ENCRYPTION_KEY
// (see calendarCrypto.ts). That module used to fail soft, silently reusing
// SESSION_SECRET when the dedicated key was unset — the same secret would then
// protect session integrity, OAuth state signing, and token confidentiality.
// Requiring it here means a deployment missing the dedicated key simply can't
// turn either connector on, rather than quietly downgrading its own crypto.
function calendarEncryptionKeyConfigured(): boolean {
  return connectorCredentialConfigured(process.env.CALENDAR_ENCRYPTION_KEY);
}

export function googleCalendarAvailable(): boolean {
  return connectorFeatureEnabled(process.env.GOOGLE_CALENDAR_ENABLED) &&
    connectorCredentialConfigured(process.env.GOOGLE_CALENDAR_CLIENT_ID) &&
    connectorCredentialConfigured(process.env.GOOGLE_CALENDAR_CLIENT_SECRET) &&
    calendarEncryptionKeyConfigured();
}

export function zohoBooksAvailable(): boolean {
  return connectorFeatureEnabled(process.env.ZOHO_BOOKS_ENABLED) &&
    connectorCredentialConfigured(process.env.ZOHO_BOOKS_CLIENT_ID) &&
    connectorCredentialConfigured(process.env.ZOHO_BOOKS_CLIENT_SECRET) &&
    calendarEncryptionKeyConfigured();
}
