# Free-hosting migration operations

Supported providers: Netlify Next.js runtime, Supabase PostgreSQL 17 and a private
Cloudflare R2 bucket. GoDaddy remains authoritative for DNS. Existing application
authentication, encryption keys, Google integrations and SMTP remain unchanged.

## Environment

Preserve all encryption key versions, session secrets, OAuth and SMTP credentials,
and current feature flags. Never commit secrets or transfer AWS IAM credentials.

| Setting | Value |
| --- | --- |
| `DATABASE_URL` | Supabase IPv4 session-pooler URL with restricted runtime role |
| `DATABASE_POOL_MAX` | `2` |
| `DATABASE_SSL_CA_BASE64` | Base64-encoded official Supabase root CA PEM |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `true` |
| `ASSET_STORAGE_PROVIDER` | `r2` |
| `S3_REGION` | `auto` |
| `S3_ENDPOINT` | Account-specific HTTPS R2 S3 endpoint |
| `ASSET_BUCKET` | Private application bucket |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | R2 object credentials scoped only to the application bucket |
| `MIGRATION_QUEUE_PROVIDER` | `netlify` |
| `NETLIFY_SITE_URL` | This environment's canonical `https://*.netlify.app` origin |
| `NETLIFY_SCHEDULES_ENABLED` | `false` until cutover; `true` only for live production |
| `APP_URL` | Existing canonical app URL |
| `HOSTING_PROVIDER` | `netlify`, using the platform client-IP header for rate limits |

Remove inherited `DATABASE_SSL_SERVERNAME`, `NODE_EXTRA_CA_CERTS` and SQS settings.
Never disable certificate verification. Keep dev and preview databases and secrets
isolated from production. Use separate admin credentials for tracked migrations;
do not give database administrator credentials to the application runtime.

## Jobs and assets

`job-dispatch` submits minute jobs to authenticated `jobs-background`, retaining
the existing email, calendar, agreements, portfolio and funnel cadence. Jobs are
gated by `CRON_SECRET` and `NETLIFY_SCHEDULES_ENABLED`. Previews disable schedules.

`migration-worker-background` reuses the import worker, leases and commit ledger.
The scheduler recovers expired leases and retryable failures up to five attempts.
The retry ceiling requires the application's manual retry flow. Monitor function
errors and credit usage. Do not enqueue into AWS SQS after cutover.

R2 does not support object tags. Import verification still checks size and SHA-256
before recording verified status in PostgreSQL. Tag-based incomplete-upload
lifecycle does not transfer; never broadly expire verified imports. Existing
portfolio cleanup continues to run. Keep buckets private, keys unchanged, and
configure CORS for actual app origins and required upload headers.

## Cutover

1. Export application schemas using PostgreSQL 17 custom-format dumps.
2. Restore into an empty application schema in a single transaction, excluding
   only the existing `public` schema and its comment TOC entries. Preserve rows,
   functions, constraints and triggers. Never drop Supabase built-in schemas,
   reset a shared database or run `prisma db push`.
3. Disable Supabase Data API and restrict tables to the application runtime role.
4. Copy every application object with unchanged keys and metadata; verify bytes.
5. Verify the Netlify candidate, browser uploads, private assets and PDFs on dev.
6. Disable old AWS scheduled jobs and pause source writes before the final export.
   Reconcile the final database and object delta before switching live traffic.
7. Change only web DNS at GoDaddy. Preserve nameservers and all mail records.
8. Verify apex, www and dev HTTPS URLs, readiness, authentication, assets and jobs.
   Enable only production schedules once the final data is in place.
9. Retain AWS for rollback until verification. Never resume writes on both copies
   without reconciliation. AWS account closure is a separate user action.

## Limits and evidence

Free hosting is usage-limited. Netlify Free pauses at the monthly credit cap;
Supabase Free has database-size and inactivity limits; R2 meters overages. Check
provider dashboards during the remaining month, particularly job compute and
bandwidth. Do not enable paid add-ons without approval.

This is a supported configuration and procedure, not a claim of completed DNS
migration. Record actual data reconciliation and live verification in the PR.
