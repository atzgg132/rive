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
follow the same operator-managed model.

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

Application rollback redeploys the previous Git SHA through the workflow.
Database rollback uses an RDS snapshot or, preferably, a tested forward
migration. Neon and Vercel are no longer part of the runtime architecture.
