# Rive AWS platform

Rive runs in `ap-south-1` on a deliberately small AWS footprint:

- one ARM64 EC2 host for the `prod` and `dev` containers;
- one private, encrypted RDS PostgreSQL instance with separate databases and roles;
- one private S3 asset bucket per environment;
- one encrypted migration queue and dead-letter queue per environment;
- ECR for immutable application and migration images;
- Google Workspace SMTP for production transactional email, with SES resources retained as a fallback;
- EventBridge and Lambda for calendar outbox, email outbox, and webhook maintenance;
- SSM Parameter Store and Session Manager instead of SSH or access keys;
- CloudWatch and AWS Budgets for operational and cost controls.

GoDaddy remains the registrar. Cloudflare will become authoritative DNS. Terraform
does not modify public DNS.

## Safety properties

- The database is not publicly accessible.
- EC2 has no inbound SSH rule.
- GitHub deploys through OIDC and a scoped AWS role.
- `dev` and `main` deploy automatically after their branch checks pass.
- Scheduled jobs default off (`scheduled_jobs_enabled`) for a new stack. The
  deployed environments explicitly enable them after health verification.
  Confirm the dev EventBridge `email_outbox` rule is ENABLED before debugging
  missing verification or inquiry mail — see `docs/RELEASE_TRANCHE_HANDOFF.md`.
- Production RDS and Terraform state have deletion protection.
- Development and test instances fall back to the EC2 SES role when
  `EMAIL_PROVIDER` is missing or set to `disabled`, preserving verification and
  recovery email on older stacks. Use `console` for an explicitly non-delivering
  local provider; SES account/sandbox restrictions still apply.

## Alerting

Every CloudWatch alarm publishes to the `rive-operations-alerts` SNS topic,
which emails `billing_alert_email`. **Confirm the SNS subscription** after the
first apply that creates it — AWS sends a confirmation link and delivers
nothing until it is clicked.

Two exceptions worth knowing:

- Route53 health checks (`www.rive.work` and `dev.rive.work` `/api/ready`)
  publish metrics only in us-east-1, so a mirrored
  `rive-operations-alerts` topic and subscription exist there behind the
  `aws.us_east_1` provider. That subscription needs its own confirmation.
- Host disk/memory/swap and container-restart alarms fire on *missing* data
  too, because silence means the CloudWatch agent or the restart monitor cron
  died, not that the host is quiet. They will show INSUFFICIENT_DATA until the
  host-side pieces below exist.

Covered signals: Lambda errors/throttles/p95 duration on the job runner,
per-rule EventBridge `FailedInvocations`, both migration DLQs, EC2 status
checks and CPU, host disk/memory/swap/container restarts, RDS
storage/CPU/connections plus failure and backup events routed through
EventBridge, Route53 public readiness, S3 asset growth, and the email-outbox
backlog metrics.

The email backlog alarms read `Rive/Application` metrics produced by log
metric filters on `/rive/app/{prod,dev}`. The emitter contract is the app's
`logMetric(name, value)` (src/utils/logger.ts), which writes a JSON line with
top-level `metricName`/`metricValue` fields; the filters match
`$.metricName` and extract `$.metricValue`. Missing data is not alarming for
these two — the fields only exist once the emitting build is deployed.

## Central logs

App containers log to `/rive/app/{prod,dev}` and the Caddy proxy to
`/rive/proxy` through Docker `awslogs` (30-day retention). Caddy emits JSON
access logs on stdout with bearer-token paths templated and URL queries and
referer query strings removed. Docker's `json-file` daemon default is bounded
at 10 MiB x 3 files for anything else, including the one-shot migration
containers.

## Human operator roles

Four MFA-gated roles exist for people; all require `MultiFactorAuthPresent`
with an auth age under one hour and cap sessions at 3600 seconds. Their ARNs
are in the `operator_role_arns` output.

| Role | Purpose |
| --- | --- |
| `rive-operator-readonly` | Read-only console/CLI access (ReadOnlyAccess). |
| `rive-deploy-operator` | Same permissions as `rive-github-deploy`, for running the deploy path by hand. |
| `rive-db-diagnostic` | RDS/CloudWatch/Logs describes, SSM port-forward sessions to the host, and read access to `/rive/*` parameters. |
| `rive-break-glass` | AdministratorAccess for incidents only. |

## Deploy contract and rollback

`scripts/deploy-runtime.sh` runs on the host on every deploy (uploaded by
`scripts/deploy-to-host.sh` from the workflow, so the reviewed version is what
executes). It refreshes the env file, runs migrations, then boots a
*candidate* app container on the alternate port — prod flips between
3000/3100, dev between 3002/3102. Only after the candidate answers
`/api/ready` does it rewrite `/opt/rive/proxy-upstreams.env`, recreate
`rive-proxy` against the canonical Caddyfile, and verify readiness through the
public domain. A failure before or during cutover restores the previous
upstream file and removes the candidate; the old container keeps serving.

On success the outgoing container is renamed to `rive-<env>-previous` and left
stopped. Instant rollback (on the host, through Session Manager):

```bash
docker stop rive-prod && docker rename rive-prod rive-prod-broken
docker rename rive-prod-previous rive-prod && docker start rive-prod
# flip the port back in /opt/rive/proxy-upstreams.env, then recreate the proxy:
docker rm -f rive-proxy
docker run -d --name rive-proxy --restart unless-stopped --network host \
  --env-file /opt/rive/proxy-upstreams.env \
  -v /opt/rive/Caddyfile:/etc/caddy/Caddyfile:ro \
  -v /opt/rive/caddy/data:/data -v /opt/rive/caddy/config:/config \
  --log-driver awslogs --log-opt awslogs-region=ap-south-1 \
  --log-opt awslogs-group=/rive/proxy --log-opt awslogs-stream=rive-proxy \
  caddy:2.10-alpine
```

## Updating an already-running host

`aws_instance.app` ignores `user_data`, so the pieces the bootstrap installs on
new hosts need one manual pass on the current host. In order:

1. Apply the Terraform, then confirm **both** SNS subscription emails.
2. Run `scripts/apply-caddy-config.sh` — it seeds
   `/opt/rive/proxy-upstreams.env` with the current ports and recreates
   `rive-proxy` with awslogs.
3. Install host telemetry through Session Manager (or send-command) as root:

   ```bash
   dnf install -y amazon-cloudwatch-agent cronie && systemctl enable --now crond
   ```

   then copy the `cloudwatch-agent.json` and `container-restart-monitor.sh`
   blocks plus the `/etc/cron.d/rive-restart-monitor` line out of
   `infrastructure/aws/templates/bootstrap.sh.tftpl` and run the
   `amazon-cloudwatch-agent-ctl -a fetch-config` command shown there.
4. Optionally write `/etc/docker/daemon.json` from the same template and
   `systemctl restart docker` in a maintenance window — it restarts every
   container, and app/proxy/migration containers already carry explicit log
   drivers, so this only bounds ad-hoc container logs.
5. Nothing else: `deploy-runtime.sh` and the canonical Caddyfile are uploaded
   by the deploy workflow itself.

Until steps 2–3 land, the CWAgent and restart alarms report INSUFFICIENT_DATA;
that state is itself the reminder.

## Terraform

> **APPLY PROTOCOL:** the state-reconciliation freeze was lifted on 2026-08-30
> after a credential-safe migration-foundation plan applied with zero destroys.
> Always save and inspect a plan before applying. Stop on any replacement or
> destroy. The live scheduled jobs are enabled and the Terraform default now
> matches that state; setting `scheduled_jobs_enabled=false` is an explicit
> incident-response action. Use a targeted plan only for a deliberately isolated
> recovery or staged rollout, then follow with a reviewed full plan to reconcile
> the remaining drift.

The bootstrap stack creates the encrypted, versioned state bucket:

```powershell
$env:AWS_PROFILE = "rive-bootstrap"
terraform -chdir=infrastructure/bootstrap init
terraform -chdir=infrastructure/bootstrap apply `
  -var="state_bucket_name=rive-terraform-state-<account-id>"
```

The platform stack uses that bucket:

```powershell
terraform -chdir=infrastructure/aws init `
  -backend-config="bucket=rive-terraform-state-<account-id>" `
  -backend-config="profile=rive-bootstrap"

terraform -chdir=infrastructure/aws plan `
  -var="billing_alert_email=<operator-email>"
```

Never commit `.tfvars`, state files, plans, credentials, database exports, or
generated environment files.

Before planning or applying email-related infrastructure, provide the Google
Workspace app password only in the current shell:

```powershell
$env:TF_VAR_smtp_password = "<Google Workspace app password>"
```

The production SMTP password and Google Calendar OAuth credentials are rotated
directly in SSM and are operator-managed after bootstrap. Terraform records the
parameters but ignores subsequent changes to their values. Admin credentials
follow the same operator-managed model. `ADMIN_TOTP_SECRET` (base32 seed from
`node scripts/setup-admin.mjs --totp`) enables the admin portal's second factor;
create `/rive/{environment}/ADMIN_TOTP_SECRET` as a SecureString when enrolling
and remove it to return to password-only sign-in.

The SMTP parameters default to `smtp.gmail.com:587` with STARTTLS as
`hello@rive.work`. Clear the shell variable after the apply. If the account uses
Google's SMTP relay instead of authenticated SMTP, set `smtp_host`, `smtp_port`,
and `smtp_secure` to the values approved in the Workspace Admin console.

After AWS approves SES production access, select the AWS SDK-based provider
before the Terraform plan:

```powershell
$env:TF_VAR_email_provider = "ses"
```

SES sends through the AWS API from the instance role. It does not require SMTP
credentials or an outbound SMTP port.

## Activation and migration queues

Terraform provisions `rive-<environment>-migration` and a matching dead-letter
queue. Queue URLs are exposed through `MIGRATION_QUEUE_URL`. Jobs are retried
five times before entering the DLQ, and CloudWatch raises an alarm when a
dead-letter message appears. The shared Lambda consumes both queues now that
the same worker endpoint has been promoted to production. Product exposure
remains independently controlled by the operator-managed
`MIGRATION_ENGINE_ENABLED` parameter.

Migration analysis and commit run through the queue contract. PostgreSQL leases,
input revisions, and the per-operation ledger make duplicate delivery safe.
`MIGRATION_ENGINE_ENABLED` is operator-managed and defaults to `false` in both
environments; enabling the product route and enabling a queue consumer are
separate rollout decisions.

## Zoho Books

Provide the server-based OAuth application credentials only in the current
Terraform shell:

```powershell
$env:TF_VAR_zoho_books_client_id = "<client-id>"
$env:TF_VAR_zoho_books_client_secret = "<client-secret>"
```

Callback URLs and requested read-only scopes are documented in
`docs/CONNECTOR_LAUNCH_SETUP.md`. Never commit these credentials to a variable
file.

## Local development against AWS

RDS is intentionally private. Local development connects to the `rive_dev`
database through an authenticated SSM port-forwarding session:

```powershell
aws sso login
npm run dev:aws
```

The helper reads the development database URL from SSM into the process, opens a
temporary tunnel on local port 5433, verifies the RDS TLS certificate against
the real endpoint, and closes the tunnel when Next.js exits. It never writes
the database password to an environment file.

## Branch promotion

| Branch | Runtime environment | Domain | Trigger |
| --- | --- | --- | --- |
| `dev` | `dev` | `dev.rive.work` | push |
| `main` | `prod` | `rive.work` | push after checks |

Promote the same reviewed commit from `dev` to `main`. Both branches run the
full lint, type, unit and Playwright suites before deploying, so `dev` is a real
gate rather than a staging copy. Images are tagged with the Git SHA and are
never overwritten.

The `test` environment was retired: it had drifted behind `main` without being
promoted through, and a stage nobody promotes through is a stale public surface
rather than a safety net.

## Cloudflare records

After the Cloudflare zone has imported every current GoDaddy record, add these
records using the Terraform `application_public_ip` output:

| Type | Name | Target | Proxy during validation |
| --- | --- | --- | --- |
| A | `dev` | application public IP | DNS only |
| A | `@` | application public IP | DNS only until cutover |
| A | `www` | application public IP | DNS only until cutover |

The production cutover is complete. Caddy obtains and renews the origin
certificates for the AWS-hosted application.

SES DKIM records are Terraform outputs. Add each token as:

```text
<token>._domainkey.rive.work CNAME <token>.dkim.amazonses.com
```

Preserve all MX, SPF, DMARC, Google verification, and existing mail records.

## Rollback

The fastest rollback is the stopped `rive-<env>-previous` container kept from
the last deploy — see "Deploy contract and rollback" above. For an older
release, redeploy the previous Git SHA through the workflow; the candidate
cutover makes even that path zero-downtime. Database rollback uses an RDS
snapshot or, preferably, a tested forward migration. Neon and Vercel are no
longer part of the runtime architecture.
