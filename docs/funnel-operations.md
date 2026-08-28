# Funnel operations runbook

The product-event backfill is deliberately dry-run by default. It only considers non-internal accounts and real `user`/`imported` records, writes versioned `source=backfill` events, and uses a unique dedupe key so an interrupted run can be resumed safely.

## Review a backfill

Run this against the target environment's database and save the report somewhere operators can review:

```bash
APP_ENV=dev npm run analytics:backfill -- --report=tmp/product-event-backfill-dev.json --json
```

Review `candidateCount`, `existingCount`, `newCandidateCount`, `countsByEvent`, and the date range before applying anything. The report contains no event payloads beyond the aggregate review information.

## Apply a reviewed backfill

The apply command requires an explicit approval flag and a candidate bound. Production requires the stronger production confirmation as well:

```bash
APP_ENV=dev npm run analytics:backfill -- --apply --confirm-backfill --max-candidates=10000 --report=tmp/product-event-backfill-dev-applied.json

APP_ENV=prod npm run analytics:backfill -- --apply --confirm-production-backfill --max-candidates=10000 --report=tmp/product-event-backfill-prod-applied.json
```

Each batch is transactional. A failed run may have completed earlier batches, but re-running the same command is idempotent. Never raise `--max-candidates` without reviewing why the candidate count changed.

## Quality monitoring

`POST /api/cron/funnel-quality` is protected by the existing `Authorization: Bearer $CRON_SECRET` contract. It returns active threshold breaches, logs a structured payload, and returns HTTP 503 only for critical issues so the AWS job runner can surface a failed scheduled invocation. Warnings remain visible in the response, admin Reliability tab, and application logs without turning every data-quality warning into a job failure.

The AWS EventBridge job is declared in `infrastructure/aws/jobs.tf` at 15-minute cadence for prod and dev. It follows the existing `scheduled_jobs_enabled` infrastructure flag and should only be enabled after the environment's DNS and application health checks are green.
