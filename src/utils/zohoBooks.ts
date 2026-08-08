import { prisma } from "@/utils/db";
import { decryptCalendarCredentials, encryptCalendarCredentials } from "@/utils/calendarCrypto";
import {
  connectorCredentialConfigured,
  zohoBooksAvailable,
} from "@/utils/connectorConfig";

export { zohoBooksAvailable };

type ZohoCredentials = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  apiDomain: string;
  accountsServer: string;
};

type ZohoOrganization = {
  organization_id: string;
  name: string;
  is_default_org?: boolean;
  currency_code?: string;
  time_zone?: string;
};

const ZOHO_ACCOUNT_HOSTS = new Set([
  "accounts.zoho.com",
  "accounts.zoho.in",
  "accounts.zoho.eu",
  "accounts.zoho.com.au",
  "accounts.zoho.jp",
  "accounts.zoho.ca",
  "accounts.zoho.com.cn",
  "accounts.zoho.sa",
]);

function config() {
  const clientId = process.env.ZOHO_BOOKS_CLIENT_ID;
  const clientSecret = process.env.ZOHO_BOOKS_CLIENT_SECRET;
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.in";
  if (!zohoBooksAvailable() || !connectorCredentialConfigured(clientId) || !connectorCredentialConfigured(clientSecret)) {
    throw new Error("Zoho Books direct migration is not enabled for this deployment.");
  }
  const parsed = new URL(accountsUrl);
  if (parsed.protocol !== "https:" || !ZOHO_ACCOUNT_HOSTS.has(parsed.hostname)) {
    throw new Error("ZOHO_ACCOUNTS_URL is not a supported Zoho data-centre endpoint.");
  }
  return {
    clientId,
    clientSecret,
    accountsUrl: parsed.origin,
    redirectUri: `${appUrl}/api/connectors/zoho-books/callback`,
  };
}

export function zohoAuthorizationUrl(state: string): string {
  const settings = config();
  const params = new URLSearchParams({
    client_id: settings.clientId,
    response_type: "code",
    redirect_uri: settings.redirectUri,
    access_type: "offline",
    prompt: "consent",
    state,
    scope: [
      "ZohoBooks.contacts.READ",
      "ZohoBooks.settings.READ",
      "ZohoBooks.projects.READ",
      "ZohoBooks.invoices.READ",
      "ZohoBooks.customerpayments.READ",
      "ZohoBooks.expenses.READ",
    ].join(","),
  });
  return `${settings.accountsUrl}/oauth/v2/auth?${params}`;
}

function safeAccountsServer(value?: string | null): string {
  const fallback = config().accountsUrl;
  if (!value) return fallback;
  const parsed = new URL(value);
  return parsed.protocol === "https:" && ZOHO_ACCOUNT_HOSTS.has(parsed.hostname) ? parsed.origin : fallback;
}

export async function exchangeZohoCode(code: string, accountsServer?: string | null): Promise<ZohoCredentials> {
  const settings = config();
  const server = safeAccountsServer(accountsServer);
  const response = await fetch(`${server}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      redirect_uri: settings.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error(`Zoho token exchange failed (${response.status}).`);
  const payload = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    api_domain?: string;
    error?: string;
  };
  if (!payload.access_token || !payload.refresh_token) {
    throw new Error(payload.error || "Zoho did not return an offline refresh token. Reconnect and grant consent.");
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + (payload.expires_in || 3600) * 1000,
    apiDomain: payload.api_domain || "https://www.zohoapis.in",
    accountsServer: server,
  };
}

async function refresh(connectionId: string, credentials: ZohoCredentials): Promise<ZohoCredentials> {
  const settings = config();
  const response = await fetch(`${credentials.accountsServer}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: credentials.refreshToken,
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const payload = await response.json() as { access_token?: string; expires_in?: number; api_domain?: string; error?: string };
  if (!response.ok || !payload.access_token) throw new Error(payload.error || "Zoho authorization was revoked.");
  const updated = {
    ...credentials,
    accessToken: payload.access_token,
    apiDomain: payload.api_domain || credentials.apiDomain,
    expiresAt: Date.now() + (payload.expires_in || 3600) * 1000,
  };
  await prisma.connectorConnection.update({
    where: { id: connectionId },
    data: { encryptedCredentials: encryptCalendarCredentials(updated), status: "connected", lastError: null },
  });
  return updated;
}

async function apiFetch<T>(
  connection: { id: string; encryptedCredentials: string },
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  let credentials = decryptCalendarCredentials<ZohoCredentials>(connection.encryptedCredentials);
  if (credentials.expiresAt < Date.now() + 60_000) credentials = await refresh(connection.id, credentials);
  const request = async () => {
    const url = new URL(`/books/v3/${path.replace(/^\//, "")}`, credentials.apiDomain);
    for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, value);
    return fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${credentials.accessToken}` } });
  };
  let response = await request();
  if (response.status === 401) {
    credentials = await refresh(connection.id, credentials);
    response = await request();
  }
  if (!response.ok) throw new Error(`Zoho Books request failed (${response.status}).`);
  const payload = await response.json() as T & { code?: number; message?: string };
  if (payload.code && payload.code !== 0) throw new Error(payload.message || "Zoho Books returned an error.");
  return payload;
}

export async function getZohoOrganizations(credentials: ZohoCredentials): Promise<ZohoOrganization[]> {
  const temporary = { id: "oauth-callback", encryptedCredentials: encryptCalendarCredentials(credentials) };
  const result = await apiFetch<{ organizations?: ZohoOrganization[] }>(temporary, "organizations");
  return result.organizations || [];
}

export async function saveZohoConnection(userId: string, credentials: ZohoCredentials, organizations: ZohoOrganization[]) {
  const organization = organizations.find((item) => item.is_default_org) || organizations[0];
  if (!organization) throw new Error("No Zoho Books organization is available for this account.");
  return prisma.connectorConnection.upsert({
    where: {
      userId_provider_providerAccountId: {
        userId,
        provider: "zoho_books",
        providerAccountId: organization.organization_id,
      },
    },
    create: {
      userId,
      provider: "zoho_books",
      providerAccountId: organization.organization_id,
      accountLabel: organization.name,
      encryptedCredentials: encryptCalendarCredentials(credentials),
      scopes: ["contacts.read", "settings.read", "projects.read", "invoices.read", "customerpayments.read", "expenses.read"],
      settings: {
        organizationId: organization.organization_id,
        organizationName: organization.name,
        currency: organization.currency_code,
        timeZone: organization.time_zone,
        organizations,
      },
    },
    update: {
      accountLabel: organization.name,
      encryptedCredentials: encryptCalendarCredentials(credentials),
      status: "connected",
      lastError: null,
      settings: {
        organizationId: organization.organization_id,
        organizationName: organization.name,
        currency: organization.currency_code,
        timeZone: organization.time_zone,
        organizations,
      },
    },
  });
}

export async function verifyZohoConnection(connectionId: string) {
  const connection = await prisma.connectorConnection.findUniqueOrThrow({ where: { id: connectionId } });
  const settings = connection.settings as { organizationId?: string } | null;
  if (!settings?.organizationId) throw new Error("Choose a Zoho Books organization before syncing.");
  await apiFetch(connection, "organizations");
  await prisma.connectorConnection.update({
    where: { id: connection.id },
    data: { status: "connected", lastError: null, lastSyncedAt: new Date() },
  });
  return connection;
}
