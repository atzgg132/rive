export function connectorCredentialConfigured(value: string | undefined): value is string {
  return Boolean(value && value.trim() && value.trim().toUpperCase() !== "UNCONFIGURED");
}

export function googleCalendarAvailable(): boolean {
  return connectorCredentialConfigured(process.env.GOOGLE_CALENDAR_CLIENT_ID) &&
    connectorCredentialConfigured(process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
}

export function zohoBooksAvailable(): boolean {
  return connectorCredentialConfigured(process.env.ZOHO_BOOKS_CLIENT_ID) &&
    connectorCredentialConfigured(process.env.ZOHO_BOOKS_CLIENT_SECRET);
}
