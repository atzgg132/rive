export function connectorCredentialConfigured(value: string | undefined): value is string {
  return Boolean(value && value.trim() && value.trim().toUpperCase() !== "UNCONFIGURED");
}

function connectorFeatureEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function googleCalendarAvailable(): boolean {
  return connectorFeatureEnabled(process.env.GOOGLE_CALENDAR_ENABLED) &&
    connectorCredentialConfigured(process.env.GOOGLE_CALENDAR_CLIENT_ID) &&
    connectorCredentialConfigured(process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
}

export function zohoBooksAvailable(): boolean {
  return connectorFeatureEnabled(process.env.ZOHO_BOOKS_ENABLED) &&
    connectorCredentialConfigured(process.env.ZOHO_BOOKS_CLIENT_ID) &&
    connectorCredentialConfigured(process.env.ZOHO_BOOKS_CLIENT_SECRET);
}
