import crypto from "crypto";
import { prisma } from "@/utils/db";
import { decryptCalendarCredentials, encryptCalendarCredentials } from "@/utils/calendarCrypto";
import { ensureDefaultCalendar } from "@/utils/calendar";
import {
  connectorCredentialConfigured,
  googleCalendarAvailable,
} from "@/utils/connectorConfig";
import { localDateTimeInZone } from "@/lib/calendar-time";
import { GOOGLE_CALENDAR_OAUTH_SCOPES } from "@/utils/googleScopes";

export { googleCalendarAvailable, GOOGLE_CALENDAR_OAUTH_SCOPES };

// Server-side outbound caps: token calls, Calendar API calls, and revocations
// each get their own budget so a hung Google endpoint can't pin a request or
// an outbox worker.
const GOOGLE_OAUTH_TIMEOUT_MS = 10_000;
const GOOGLE_API_TIMEOUT_MS = 15_000;
const GOOGLE_REVOKE_TIMEOUT_MS = 5_000;

type GoogleCredentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

type GoogleCalendarListItem = {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
  accessRole?: string;
  timeZone?: string;
};

type GoogleEvent = {
  id: string;
  iCalUID?: string;
  etag?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  updated?: string;
  transparency?: string;
  visibility?: string;
  recurrence?: string[];
  recurringEventId?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  extendedProperties?: { private?: { riveEventId?: string } };
};

function googleConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  if (!googleCalendarAvailable() || !connectorCredentialConfigured(clientId) || !connectorCredentialConfigured(clientSecret)) {
    throw new Error("Google Calendar is not enabled for this deployment.");
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/calendar/connections/google/callback`,
    appUrl,
  };
}

export function googleAuthorizationUrl(state: string, loginHint?: string): string {
  const config = googleConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    access_type: "offline",
    // consent keeps reissuing refresh tokens on reconnect; select_account
    // forces the chooser so a multi-account browser can't silently attach the
    // wrong Google account to this Rive user.
    prompt: "consent select_account",
    include_granted_scopes: "true",
    state,
    scope: GOOGLE_CALENDAR_OAUTH_SCOPES.join(" "),
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string): Promise<GoogleCredentials> {
  const config = googleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(GOOGLE_OAUTH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Google token exchange failed (${response.status}).`);
  const payload = await response.json() as { access_token: string; refresh_token?: string; expires_in: number };
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };
}

/**
 * The grant is dead (revoked at Google, or no usable refresh token). Mark the
 * connection so every surface — calendar UI, onboarding, admin — can offer
 * reconnect instead of presenting a healthy-looking badge. The update itself
 * must never mask the original failure.
 */
/**
 * Google's token endpoint answers a refresh with 400 + `invalid_grant` only
 * when the grant itself is dead (revoked or expired beyond use). Every other
 * failure — 5xx, network, client misconfiguration — is transient for the user
 * and must not flag the connection for reconnect.
 */
export function isRevokedGrantResponse(status: number, body: string): boolean {
  return status === 400 && body.includes("invalid_grant");
}

async function markConnectionNeedsReconnect(connectionId: string, message: string) {
  await prisma.calendarConnection.update({
    where: { id: connectionId },
    data: { status: "needs_reconnect", lastError: message.slice(0, 500) },
  }).catch((error) => console.error("Could not flag Google connection for reconnect:", error));
}

async function refreshCredentials(connectionId: string, credentials: GoogleCredentials): Promise<GoogleCredentials> {
  if (!credentials.refreshToken) {
    await markConnectionNeedsReconnect(connectionId, "Google access expired. Reconnect the account.");
    throw new Error("Google access expired. Reconnect the account.");
  }
  const config = googleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: credentials.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(GOOGLE_OAUTH_TIMEOUT_MS),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    // invalid_grant means the grant itself is gone — flag it so the UI can
    // offer reconnect. Anything else (5xx, network blip, client config) is
    // transient or operator-side and must not strand a healthy connection.
    if (isRevokedGrantResponse(response.status, detail)) {
      await markConnectionNeedsReconnect(connectionId, "Google access was revoked. Reconnect the account.");
      throw new Error("Google access was revoked. Reconnect the account.");
    }
    throw new Error(`Google token refresh failed (${response.status}).`);
  }
  const payload = await response.json() as { access_token: string; refresh_token?: string; expires_in: number };
  const refreshed = {
    ...credentials,
    accessToken: payload.access_token,
    // Google occasionally rotates the refresh token — keep whichever is newest.
    refreshToken: payload.refresh_token || credentials.refreshToken,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };
  await prisma.calendarConnection.update({
    where: { id: connectionId },
    data: { encryptedCredentials: encryptCalendarCredentials(refreshed), status: "connected", lastError: null },
  });
  return refreshed;
}

async function googleFetch<T>(
  connection: { id: string; encryptedCredentials: string },
  path: string,
  init?: RequestInit,
): Promise<T> {
  let credentials = decryptCalendarCredentials<GoogleCredentials>(connection.encryptedCredentials);
  if (credentials.expiresAt < Date.now() + 60_000) credentials = await refreshCredentials(connection.id, credentials);
  const perform = (accessToken: string) => fetch(`https://www.googleapis.com${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(GOOGLE_API_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  let response = await perform(credentials.accessToken);
  if (response.status === 401) {
    credentials = await refreshCredentials(connection.id, credentials);
    response = await perform(credentials.accessToken);
  }

  // Transient failures (rate limit, momentary 5xx) get a couple of short
  // retries so a blip doesn't flip the whole connection to an error state.
  // Anything else — including a second 401 — surfaces immediately.
  const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);
  for (const delayMs of [300, 900]) {
    if (response.ok || !TRANSIENT_STATUSES.has(response.status)) break;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    response = await perform(credentials.accessToken);
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Google Calendar request failed (${response.status}): ${detail}`);
  }
  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("Google Calendar returned a response that could not be read.");
  }
}

/**
 * Revoke Rive's grant at Google so a "disconnected" refresh token can't still
 * be used. Best-effort: a revoke failure (network blip, already-revoked token)
 * must never block the local disconnect the user actually asked for.
 */
export async function revokeGoogleCredentials(encryptedCredentials: string): Promise<void> {
  let credentials: GoogleCredentials;
  try {
    credentials = decryptCalendarCredentials<GoogleCredentials>(encryptedCredentials);
  } catch {
    return;
  }
  const token = credentials.refreshToken || credentials.accessToken;
  if (!token) return;
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(GOOGLE_REVOKE_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("Google token revocation failed; local disconnect still proceeds:", error);
  }
}

export async function getGoogleAccount(credentials: GoogleCredentials) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${credentials.accessToken}` },
    signal: AbortSignal.timeout(GOOGLE_API_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("Could not read the connected Google account.");
  return response.json() as Promise<{ sub: string; email?: string }>;
}

export async function saveGoogleConnection(userId: string, credentials: GoogleCredentials) {
  const account = await getGoogleAccount(credentials);
  const existing = await prisma.calendarConnection.findUnique({
    where: {
      userId_provider_providerAccountId: {
        userId,
        provider: "google",
        providerAccountId: account.sub,
      },
    },
  });
  const merged = existing
    ? { ...decryptCalendarCredentials<GoogleCredentials>(existing.encryptedCredentials), ...credentials, refreshToken: credentials.refreshToken || decryptCalendarCredentials<GoogleCredentials>(existing.encryptedCredentials).refreshToken }
    : credentials;
  return prisma.calendarConnection.upsert({
    where: {
      userId_provider_providerAccountId: {
        userId,
        provider: "google",
        providerAccountId: account.sub,
      },
    },
    create: {
      userId,
      provider: "google",
      providerAccountId: account.sub,
      accountEmail: account.email,
      encryptedCredentials: encryptCalendarCredentials(merged),
      scopes: ["calendar.calendarlist.readonly", "calendar.events"],
    },
    update: {
      accountEmail: account.email,
      encryptedCredentials: encryptCalendarCredentials(merged),
      status: "connected",
      lastError: null,
    },
  });
}

export async function discoverGoogleCalendars(connectionId: string) {
  const connection = await prisma.calendarConnection.findUniqueOrThrow({ where: { id: connectionId } });
  const result = await googleFetch<{ items?: GoogleCalendarListItem[] }>(connection, "/calendar/v3/users/me/calendarList");
  await ensureDefaultCalendar(connection.userId);
  for (const item of result.items || []) {
    if (!item.id) continue;
    const existing = await prisma.externalCalendar.findUnique({
      where: { connectionId_providerCalendarId: { connectionId, providerCalendarId: item.id } },
    });
    if (existing) {
      await prisma.$transaction([
        prisma.calendar.update({
          where: { id: existing.calendarId },
          data: {
            name: item.summary || "Google Calendar",
            color: item.backgroundColor || undefined,
            timeZone: item.timeZone || undefined,
          },
        }),
        prisma.externalCalendar.update({
          where: { id: existing.id },
          data: {
            name: item.summary || "Google Calendar",
            color: item.backgroundColor,
            accessRole: item.accessRole,
          },
        }),
      ]);
    } else {
      const local = await prisma.calendar.create({
        data: {
          userId: connection.userId,
          name: item.summary || "Google Calendar",
          color: item.backgroundColor || "#4285F4",
          timeZone: item.timeZone || "UTC",
        },
      });
      await prisma.externalCalendar.create({
        data: {
          connectionId,
          calendarId: local.id,
          providerCalendarId: item.id,
          name: item.summary || "Google Calendar",
          color: item.backgroundColor,
          accessRole: item.accessRole,
          selected: item.primary === true,
        },
      });
    }
    if (item.primary) {
      await prisma.calendarConnection.update({
        where: { id: connectionId },
        data: { defaultExternalCalendarId: item.id },
      });
    }
  }
  return prisma.externalCalendar.findMany({ where: { connectionId }, include: { calendar: true } });
}

function fingerprintGoogleEvent(event: GoogleEvent): string {
  return crypto.createHash("sha256").update(JSON.stringify({
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: event.start,
    end: event.end,
    status: event.status,
    recurrence: event.recurrence,
  })).digest("hex");
}

async function upsertGoogleEvent(
  external: { id: string; calendarId: string; accessRole: string | null; connection: { userId: string } },
  event: GoogleEvent,
) {
  const mapping = await prisma.externalEventMapping.findUnique({
    where: { externalCalendarId_providerEventId: { externalCalendarId: external.id, providerEventId: event.id } },
  });
  if (event.status === "cancelled") {
    if (mapping) {
      await prisma.calendarEvent.update({
        where: { id: mapping.eventId },
        data: { status: "cancelled", deletedAt: new Date() },
      });
    }
    return;
  }
  const allDay = Boolean(event.start?.date);
  const source = ["reader", "freeBusyReader"].includes(external.accessRole || "") ? "external_readonly" : "google";
  const data = {
    userId: external.connection.userId,
    calendarId: external.calendarId,
    title: event.summary || "(untitled event)",
    description: event.description || null,
    location: event.location || null,
    meetingUrl: event.hangoutLink || null,
    allDay,
    startAt: allDay || !event.start?.dateTime ? null : new Date(event.start.dateTime),
    endAt: allDay || !event.end?.dateTime ? null : new Date(event.end.dateTime),
    startDate: allDay ? event.start?.date || null : null,
    endDate: allDay ? event.end?.date || null : null,
    timeZone: event.start?.timeZone || event.end?.timeZone || "UTC",
    availability: event.transparency === "transparent" ? "free" : "busy",
    visibility: event.visibility || "default",
    status: event.status || "confirmed",
    recurrenceRule: event.recurrence?.join("\n") || null,
    recurringMasterId: event.recurringEventId || null,
    source,
    dataOrigin: "imported",
    deletedAt: null,
  };
  const local = mapping
    ? await prisma.calendarEvent.update({ where: { id: mapping.eventId }, data })
    : await prisma.calendarEvent.create({ data });
  await prisma.externalEventMapping.upsert({
    where: { externalCalendarId_providerEventId: { externalCalendarId: external.id, providerEventId: event.id } },
    create: {
      eventId: local.id,
      externalCalendarId: external.id,
      providerEventId: event.id,
      iCalUid: event.iCalUID,
      providerEtag: event.etag,
      providerUpdatedAt: event.updated ? new Date(event.updated) : null,
      lastFingerprint: fingerprintGoogleEvent(event),
    },
    update: {
      providerEtag: event.etag,
      providerUpdatedAt: event.updated ? new Date(event.updated) : null,
      lastFingerprint: fingerprintGoogleEvent(event),
    },
  });
}

export async function syncGoogleCalendar(externalCalendarId: string) {
  const external = await prisma.externalCalendar.findUniqueOrThrow({
    where: { id: externalCalendarId },
    include: { connection: true },
  });
  if (!external.selected) return;
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  let fullSync = !external.syncToken;
  do {
    const params = new URLSearchParams({ showDeleted: "true", maxResults: "2500", singleEvents: "true" });
    if (pageToken) params.set("pageToken", pageToken);
    if (external.syncToken && !fullSync) {
      params.set("syncToken", external.syncToken);
    } else {
      const from = new Date();
      from.setUTCMonth(from.getUTCMonth() - 3);
      const to = new Date();
      to.setUTCFullYear(to.getUTCFullYear() + 1);
      params.set("timeMin", from.toISOString());
      params.set("timeMax", to.toISOString());
    }
    try {
      const response = await googleFetch<{ items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string }>(
        external.connection,
        `/calendar/v3/calendars/${encodeURIComponent(external.providerCalendarId)}/events?${params}`,
      );
      for (const event of response.items || []) await upsertGoogleEvent(external, event);
      pageToken = response.nextPageToken;
      nextSyncToken = response.nextSyncToken || nextSyncToken;
    } catch (error) {
      if (!fullSync && error instanceof Error && error.message.includes("(410)")) {
        fullSync = true;
        pageToken = undefined;
        await prisma.externalCalendar.update({ where: { id: external.id }, data: { syncToken: null } });
        continue;
      }
      throw error;
    }
  } while (pageToken);
  await prisma.$transaction([
    prisma.externalCalendar.update({
      where: { id: external.id },
      data: { syncToken: nextSyncToken, lastSyncedAt: new Date() },
    }),
    prisma.calendarConnection.update({
      where: { id: external.connectionId },
      data: { status: "connected", lastSyncedAt: new Date(), lastError: null },
    }),
  ]);
}

export async function syncGoogleConnection(connectionId: string) {
  const calendars = await prisma.externalCalendar.findMany({ where: { connectionId, selected: true } });
  for (const calendar of calendars) await syncGoogleCalendar(calendar.id);
}

export async function watchGoogleCalendar(externalCalendarId: string) {
  const external = await prisma.externalCalendar.findUniqueOrThrow({
    where: { id: externalCalendarId },
    include: { connection: true },
  });
  const config = googleConfig();
  if (!config.appUrl.startsWith("https://")) return null;
  const id = crypto.randomUUID();
  const channelToken = crypto.randomBytes(24).toString("base64url");
  const response = await googleFetch<{ resourceId: string; expiration?: string }>(
    external.connection,
    `/calendar/v3/calendars/${encodeURIComponent(external.providerCalendarId)}/events/watch`,
    {
      method: "POST",
      body: JSON.stringify({
        id,
        token: channelToken,
        type: "web_hook",
        address: `${config.appUrl}/api/calendar/webhooks/google`,
        params: { ttl: "604800" },
      }),
    },
  );
  await prisma.calendarWebhookChannel.create({
    data: {
      id,
      connectionId: external.connectionId,
      externalCalendarId: external.id,
      resourceId: response.resourceId,
      channelToken,
      expiresAt: response.expiration ? new Date(Number(response.expiration)) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return id;
}

export function eventToGooglePayload(event: {
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date | null;
  endAt: Date | null;
  startDate: string | null;
  endDate: string | null;
  allDay: boolean;
  timeZone: string;
  availability: string;
}) {
  // Send the naive wall time plus the named zone — Google's recommended form.
  // A Z-suffixed dateTime alongside timeZone is overspecified: it happens to
  // work today because Google's offset-wins precedence, but it silently breaks
  // if the stored zone and the instant ever disagree.
  const startDateTime = event.allDay || !event.startAt ? null : localDateTimeInZone(event.startAt, event.timeZone);
  const endDateTime = event.allDay || !event.endAt ? null : localDateTimeInZone(event.endAt, event.timeZone);
  return {
    summary: event.title,
    description: event.description || undefined,
    location: event.location || undefined,
    start: event.allDay ? { date: event.startDate } : { dateTime: startDateTime, timeZone: event.timeZone },
    end: event.allDay ? { date: event.endDate } : { dateTime: endDateTime, timeZone: event.timeZone },
    transparency: event.availability === "free" ? "transparent" : "opaque",
    extendedProperties: { private: { riveEventId: "" } },
  };
}

export async function pushEventToGoogle(eventId: string, operation: "create" | "update" | "delete"): Promise<boolean> {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: { externalMappings: { include: { externalCalendar: { include: { connection: true } } } } },
  });
  if (!event) return false;
  const mapping = event.externalMappings.find((item) => item.externalCalendar.connection.provider === "google");
  if (mapping) {
    const external = mapping.externalCalendar;
    if (operation === "delete") {
      await googleFetch<void>(external.connection, `/calendar/v3/calendars/${encodeURIComponent(external.providerCalendarId)}/events/${encodeURIComponent(mapping.providerEventId)}`, { method: "DELETE" });
      return true;
    }
    const payload = eventToGooglePayload(event);
    payload.extendedProperties.private.riveEventId = event.id;
    const updated = await googleFetch<GoogleEvent>(
      external.connection,
      `/calendar/v3/calendars/${encodeURIComponent(external.providerCalendarId)}/events/${encodeURIComponent(mapping.providerEventId)}?sendUpdates=none`,
      { method: "PATCH", body: JSON.stringify(payload), headers: mapping.providerEtag ? { "If-Match": mapping.providerEtag } : undefined },
    );
    await prisma.externalEventMapping.update({
      where: { id: mapping.id },
      data: { providerEtag: updated.etag, providerUpdatedAt: updated.updated ? new Date(updated.updated) : null, lastFingerprint: fingerprintGoogleEvent(updated) },
    });
    return true;
  }
  if (operation !== "create") return false;
  // Resolve the destination deterministically — with more than one Google
  // account connected, an unordered findFirst could write the event to a
  // different account than the user expects. Preference order:
  // 1. the Google calendar that mirrors this event's local calendar;
  // 2. the oldest healthy connection's default calendar.
  const READ_ONLY_ROLES = ["reader", "freeBusyReader"];
  const mappedExternal = await prisma.externalCalendar.findFirst({
    where: {
      calendarId: event.calendarId,
      connection: { userId: event.userId, provider: "google", status: "connected" },
    },
    include: { connection: true },
  });
  let external = mappedExternal && !READ_ONLY_ROLES.includes(mappedExternal.accessRole || "") ? mappedExternal : null;
  if (!external) {
    const connection = await prisma.calendarConnection.findFirst({
      where: { userId: event.userId, provider: "google", status: "connected", defaultExternalCalendarId: { not: null } },
      orderBy: { createdAt: "asc" },
    });
    if (connection?.defaultExternalCalendarId) {
      const fallback = await prisma.externalCalendar.findUnique({
        where: { connectionId_providerCalendarId: { connectionId: connection.id, providerCalendarId: connection.defaultExternalCalendarId } },
        include: { connection: true },
      });
      if (fallback && !READ_ONLY_ROLES.includes(fallback.accessRole || "")) external = fallback;
    }
  }
  if (!external) return false;

  // Search-before-create safety net. If a previous attempt's Google POST
  // succeeded but the local mapping write was lost (crash, network blip, or a
  // race), a retry would otherwise create a second event. Every event we push
  // carries `extendedProperties.private.riveEventId`, so we can ask Google for
  // the event we already created and adopt it instead of duplicating it.
  const existing = await findGoogleEventByRiveId(external.connection, external.providerCalendarId, event.id);
  if (existing) {
    await prisma.externalEventMapping.create({
      data: {
        eventId: event.id,
        externalCalendarId: external.id,
        providerEventId: existing.id,
        iCalUid: existing.iCalUID,
        providerEtag: existing.etag,
        providerUpdatedAt: existing.updated ? new Date(existing.updated) : null,
        lastFingerprint: fingerprintGoogleEvent(existing),
      },
    });
    return true;
  }

  const payload = eventToGooglePayload(event);
  payload.extendedProperties.private.riveEventId = event.id;
  const created = await googleFetch<GoogleEvent>(
    external.connection,
    `/calendar/v3/calendars/${encodeURIComponent(external.providerCalendarId)}/events?sendUpdates=none`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  await prisma.externalEventMapping.create({
    data: {
      eventId: event.id,
      externalCalendarId: external.id,
      providerEventId: created.id,
      iCalUid: created.iCalUID,
      providerEtag: created.etag,
      providerUpdatedAt: created.updated ? new Date(created.updated) : null,
      lastFingerprint: fingerprintGoogleEvent(created),
    },
  });
  return true;
}

/**
 * Find a Google Calendar event this Rive event previously pushed, by the
 * private `riveEventId` extended property. Returns null when Google has no
 * record of it — the caller may then create it.
 */
async function findGoogleEventByRiveId(
  connection: { id: string; encryptedCredentials: string },
  providerCalendarId: string,
  riveEventId: string,
): Promise<GoogleEvent | null> {
  const result = await googleFetch<{ items?: GoogleEvent[] }>(
    connection,
    `/calendar/v3/calendars/${encodeURIComponent(providerCalendarId)}/events?privateExtendedProperty=${encodeURIComponent(`riveEventId=${riveEventId}`)}&maxResults=5&singleEvents=true`,
  );
  // Only adopt an event that genuinely carries this Rive event's id. The
  // filter should guarantee it, but if Google ever ignores the property we
  // must not adopt an unrelated event.
  const items = result.items || [];
  return items.find((item) => item.extendedProperties?.private?.riveEventId === riveEventId) || null;
}
