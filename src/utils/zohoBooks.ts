import { prisma } from "@/utils/db";
import { decryptCalendarCredentials, encryptCalendarCredentials } from "@/utils/calendarCrypto";
import {
  connectorCredentialConfigured,
  zohoBooksAvailable,
} from "@/utils/connectorConfig";
import {
  createZohoProvider,
  zohoHttpError,
  ZohoAuthError,
  type ZohoOrganization,
} from "@/lib/migration/adapters/zoho";

export { zohoBooksAvailable };

type ZohoCredentials = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  apiDomain: string;
  accountsServer: string;
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

/**
 * Bounded retry schedule for Zoho transient failures (429/5xx).
 *
 * Pure so it can be unit-tested: the caller decides whether a status is
 * transient, and this decides how long to wait (honoring `Retry-After`) and
 * when to stop. Two short retries, then surface the error — a blip shouldn't
 * flip a connection to an error state, but a genuinely failing endpoint must
 * not keep the request hanging.
 */
export function zohoRetryDelays(status: number, retryAfterHeader: string | null): number[] {
  if (status !== 429 && !(status >= 500 && status <= 599)) return [];
  const retryAfter = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : Number.NaN;
  const base = Number.isFinite(retryAfter) ? Math.max(1, retryAfter) * 1000 : null;
  return [base ?? 300, base ?? 900];
}

async function zohoFetch<T>(
  connection: { id: string; encryptedCredentials: string },
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  let credentials = decryptCalendarCredentials<ZohoCredentials>(connection.encryptedCredentials);
  if (credentials.expiresAt < Date.now() + 60_000) credentials = await refresh(connection.id, credentials);
  const perform = (token: string) => {
    const url = new URL(`/books/v3/${path.replace(/^\//, "")}`, credentials.apiDomain);
    for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, value);
    return fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
  };

  let response = await perform(credentials.accessToken);
  if (response.status === 401) {
    credentials = await refresh(connection.id, credentials);
    response = await perform(credentials.accessToken);
  }

  for (const delayMs of zohoRetryDelays(response.status, response.headers.get("Retry-After"))) {
    if (response.ok) break;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    response = await perform(credentials.accessToken);
  }

  if (!response.ok) {
    throw zohoHttpError(response.status);
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("Zoho Books returned a response that could not be read.");
  }
}

/** A FetchPage transport wired to the real Zoho client, for the provider seam. */
function zohoFetchPage(connection: { id: string; encryptedCredentials: string }) {
  return async (path: string, options?: { params?: Record<string, string>; retry?: boolean }) => {
    return zohoFetch(connection, path, options?.params);
  };
}

export async function getZohoOrganizations(credentials: ZohoCredentials): Promise<ZohoOrganization[]> {
  const temporary = { id: "oauth-callback", encryptedCredentials: encryptCalendarCredentials(credentials) };
  const provider = createZohoProvider();
  const listed = await provider.listOrganizations(zohoFetchPage(temporary));
  // The provider seam returns the mapped shape; the callback stores the raw
  // Zoho organization objects so nothing is lost (ids, currency, timezone).
  return listed.map((organization) => ({
    organization_id: organization.id,
    name: organization.name,
    currency_code: organization.currency || undefined,
  }));
}

/**
 * Save a Zoho connection WITHOUT choosing an organization.
 *
 * The OAuth callback stores the candidate organizations in `settings`; the
 * user explicitly picks one via `POST /api/connectors/zoho-books/organization`
 * before any sync runs. `saveZohoConnection` never auto-selects — that
 * contradicted the onboarding copy which promises confirmation.
 */
export async function saveZohoConnection(userId: string, credentials: ZohoCredentials, organizations: ZohoOrganization[]) {
  if (!organizations.length) throw new Error("No Zoho Books organization is available for this account.");
  const settings = {
    organizations: organizations.map((organization) => ({
      id: organization.organization_id,
      name: organization.name,
      currency: organization.currency_code || null,
      timeZone: organization.time_zone || null,
    })),
    // organizationId is deliberately absent until the user confirms.
  };
  const first = organizations[0];
  return prisma.connectorConnection.upsert({
    where: {
      userId_provider_providerAccountId: {
        userId,
        provider: "zoho_books",
        providerAccountId: first.organization_id,
      },
    },
    create: {
      userId,
      provider: "zoho_books",
      providerAccountId: first.organization_id,
      accountLabel: first.name,
      encryptedCredentials: encryptCalendarCredentials(credentials),
      scopes: ["contacts.read", "settings.read", "projects.read", "invoices.read", "customerpayments.read", "expenses.read"],
      settings,
    },
    update: {
      accountLabel: first.name,
      encryptedCredentials: encryptCalendarCredentials(credentials),
      status: "connected",
      lastError: null,
      settings,
    },
  });
}

/**
 * Confirm the organization the user actually picked. Sync is refused until
 * this has been called with one of the stored `settings.organizations` ids.
 */
export async function confirmZohoOrganization(connectionId: string, userId: string, organizationId: string) {
  const connection = await prisma.connectorConnection.findFirst({
    where: { id: connectionId, userId, provider: "zoho_books" },
  });
  if (!connection) throw new ZohoNotFound("Zoho Books connection not found.");
  const settings = (connection.settings as { organizations?: Array<{ id: string; name: string; currency?: string | null }> } | null) || {};
  const organization = (settings.organizations || []).find((item) => item.id === organizationId);
  if (!organization) {
    throw new ZohoValidationError("Choose one of the organizations listed for this account.");
  }
  const updated = await prisma.connectorConnection.update({
    where: { id: connection.id },
    data: {
      providerAccountId: organization.id,
      accountLabel: organization.name,
      settings: {
        ...settings,
        organizationId: organization.id,
        organizationName: organization.name,
        currency: organization.currency || null,
      },
      status: "connected",
      lastError: null,
    },
  });
  return updated;
}

export class ZohoNotFound extends Error {}
export class ZohoValidationError extends Error {}

export async function verifyZohoConnection(connectionId: string) {
  const connection = await prisma.connectorConnection.findUniqueOrThrow({ where: { id: connectionId } });
  const settings = connection.settings as { organizationId?: string } | null;
  if (!settings?.organizationId) throw new Error("Choose a Zoho Books organization before syncing.");
  // Confirm the stored API domain is still a sanctioned Zoho host before any
  // request is made (fail closed, never a silent fallback).
  createZohoProvider().resolveApiDomain(decryptCalendarCredentials<{ apiDomain?: string }>(connection.encryptedCredentials));
  await zohoFetch(connection, "organizations");
  await prisma.connectorConnection.update({
    where: { id: connection.id },
    data: { status: "connected", lastError: null, lastSyncedAt: new Date() },
  });
  return connection;
}

/**
 * Revoke Rive's Zoho grant so a disconnected refresh token can't still be
 * used. Best-effort, mirroring `revokeGoogleCredentials`: a revoke failure
 * must never block the local disconnect the user asked for.
 */
export async function revokeZohoCredentials(encryptedCredentials: string): Promise<void> {
  let credentials: ZohoCredentials;
  try {
    credentials = decryptCalendarCredentials<ZohoCredentials>(encryptedCredentials);
  } catch {
    return;
  }
  const token = credentials.refreshToken || credentials.accessToken;
  if (!token) return;
  try {
    await fetch(`${credentials.accountsServer}/oauth/v2/token/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch (error) {
    console.error("Zoho token revocation failed; local disconnect still proceeds:", error);
  }
}

export { ZohoAuthError };
