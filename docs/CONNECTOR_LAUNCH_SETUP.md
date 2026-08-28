# Connector launch setup

Rive currently has two substantial onboarding ingestion foundations.

1. Google Calendar OAuth with encrypted token storage, calendar discovery, initial event import, ongoing synchronization, webhook renewal, and Rive-to-Google event updates. This is enabled in deployed environments when credentials are present.
2. Universal CSV migration for clients, projects, invoices, and expenses, including previews, deduplication, and relationship matching. Launch still requires a hosted disposable-database pass.

The onboarding UI exposes Google Calendar only when its flag and credentials are present. CSV provider names describe supported export formats; they are not presented as direct API connections.

## Apple Calendar support

Rive provides a revocable, per-user iCalendar subscription URL from the
Calendar screen. Adding that URL to Apple Calendar keeps Rive events visible
there without exposing Rive credentials. This is a one-way Rive-to-Apple
subscription, which is the reliable standards-based integration available
without collecting a user's Apple app-specific password.

Rive does not claim two-way Apple Calendar sync. A future CalDAV connector would
need encrypted app-specific-password storage, conflict resolution, account
revocation, and production testing across iCloud calendar edge cases before it
could be presented as a live connector.

## Google Calendar credentials required

Create one Google Cloud project for Rive and provide:

- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`

Google Cloud configuration:

1. Enable the Google Calendar API.
2. Configure the OAuth consent screen as an external application.
3. Add `rive.work` as an authorized domain.
4. Configure the product name, support email, privacy policy, terms, and `hello@rive.work` developer contact.
5. Request these scopes (app login and Calendar must match this list exactly):
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
   - `https://www.googleapis.com/auth/calendar.events`
6. Create an OAuth 2.0 Web application client.
7. Add these exact redirect URIs:
   - `http://localhost:3000/api/auth/google/callback`
   - `https://dev.rive.work/api/auth/google/callback`
   - `https://www.rive.work/api/auth/google/callback`
   - `http://localhost:3000/api/calendar/connections/google/callback`
   - `https://dev.rive.work/api/calendar/connections/google/callback`
   - `https://www.rive.work/api/calendar/connections/google/callback`

Sign in with Google is a separate OAuth request (`openid email profile` only). Calendar connect is a later, explicit step and requests Calendar scopes plus `openid` and `email` so the connected Google account can be identified. Do not add Calendar scopes to login.

`GOOGLE_CALENDAR_ENABLED` is true for both the `dev` SSM environment (https://dev.rive.work) and production (https://www.rive.work).
8. While the consent screen is in testing, add every person who needs to test as a Google OAuth test user.
9. Before broad launch, submit the consent screen for Google verification. Calendar event access is a sensitive scope and an unverified production app will be constrained.

Each deployed environment also needs:

- `APP_URL` matching its public origin.
- `SESSION_SECRET`.
- `CALENDAR_ENCRYPTION_KEY`, preferably a base64-encoded 32-byte random value.
- `CRON_SECRET` for calendar maintenance and outbox jobs.

Never commit provider secrets. Store them in the existing AWS SSM parameters for each environment.

## Credentials needed for additional direct accounting connectors

These are not enabled in the product until their provider applications and credentials are supplied:

| Provider | What to create | Credentials required | Primary imported records |
| --- | --- | --- | --- |
| QuickBooks Online | Intuit Developer production app | Client ID, client secret, webhook verifier token | Customers, projects, invoices, payments, expenses |
| Xero | Xero OAuth 2.0 web app | Client ID, client secret, webhook signing key | Contacts, invoices, payments, bank transactions |
| Zoho Books | Zoho API Console server app | Client ID, client secret, regional data centre | Contacts, projects, invoices, expenses |
| FreshBooks | FreshBooks developer app | Client ID, client secret | Clients, projects, invoices, expenses, time entries |

For each provider, Rive will require local, development, and production callback URLs following:

`https://<environment-domain>/api/connectors/<provider>/callback`

Before implementing a provider, also supply a sandbox/demo organization containing representative records. This is necessary to verify pagination, currencies, taxes, deleted records, duplicate handling, and incremental synchronization without touching real business data.

## Recommended launch order

1. Complete and verify Google Calendar OAuth.
2. Keep universal CSV migration available for every accounting platform.
3. Add QuickBooks Online as the first direct financial connector.
4. Add Xero.
5. Add Zoho Books for India and APAC-heavy adoption.
6. Add FreshBooks when customer demand justifies its maintenance cost.

Direct financial integrations should not be displayed as available until OAuth, initial import, incremental sync, disconnect/revocation, audit logging, and failure recovery all pass production tests.

## Zoho Books OAuth setup

The repository contains the provider-neutral connection model, encrypted Zoho
credential storage, multi-data-centre callback handling, organization discovery,
connection verification, sync-run history, and onboarding entry point.

Create a **Server-based Application** in the Zoho API Console and register:

- `http://localhost:3000/api/connectors/zoho-books/callback`
- `https://dev.rive.work/api/connectors/zoho-books/callback`
- `https://www.rive.work/api/connectors/zoho-books/callback`

Provide these secrets independently for each environment:

- `ZOHO_BOOKS_CLIENT_ID`
- `ZOHO_BOOKS_CLIENT_SECRET`
- `ZOHO_ACCOUNTS_URL=https://accounts.zoho.in`

The requested access is read-only for contacts, settings, projects, invoices,
customer payments, and expenses. Multi-DC support should be enabled in Zoho if
Rive will accept accounts outside the Indian Zoho data centre.

Do not advertise automatic Zoho record ingestion until the organization
confirmation and initial-import review screen have passed sandbox testing with
representative contacts, invoices, payments, projects, taxes, currencies,
archived records, and pagination.
