# Rive AWS platform

Rive runs in `ap-south-1` on a deliberately small AWS footprint:

- one ARM64 EC2 host for the `prod`, `test`, and `dev` containers;
- one private, encrypted RDS PostgreSQL instance with separate databases and roles;
- one private S3 asset bucket per environment;
- ECR for immutable application and migration images;
- SES for production transactional email;
- EventBridge and Lambda for calendar outbox and webhook maintenance;
- SSM Parameter Store and Session Manager instead of SSH or access keys;
- CloudWatch and AWS Budgets for operational and cost controls.

GoDaddy remains the registrar. Cloudflare will become authoritative DNS. Terraform
does not modify public DNS.

## Safety properties

- The database is not publicly accessible.
- EC2 has no inbound SSH rule.
- GitHub deploys through OIDC and a scoped AWS role.
- `main` deploys only through manual workflow dispatch.
- Scheduled jobs are disabled until DNS and all applications are healthy.
- Production RDS and Terraform state have deletion protection.
- Development and test suppress real email delivery.

## Terraform

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

## Branch promotion

| Branch | Runtime environment | Domain | Trigger |
| --- | --- | --- | --- |
| `dev` | `dev` | `dev.rive.work` | push |
| `test` | `test` | `test.rive.work` | push |
| `main` | `prod` | `rive.work` | manual workflow dispatch |

Promote the same reviewed commit from `dev` to `test`, then merge it to `main`.
Images are tagged with the Git SHA and are never overwritten.

## Cloudflare records

After the Cloudflare zone has imported every current GoDaddy record, add these
records using the Terraform `application_public_ip` output:

| Type | Name | Target | Proxy during validation |
| --- | --- | --- | --- |
| A | `dev` | application public IP | DNS only |
| A | `test` | application public IP | DNS only |
| A | `@` | application public IP | DNS only until cutover |
| A | `www` | application public IP | DNS only until cutover |

Do not change `@` or `www` until production validation and the final Neon write
freeze. Caddy obtains and renews the origin certificates.

SES DKIM records are Terraform outputs. Add each token as:

```text
<token>._domainkey.rive.work CNAME <token>.dkim.amazonses.com
```

Preserve all MX, SPF, DMARC, Google verification, and existing mail records.

## Rollback

Application rollback redeploys the previous Git SHA through the workflow.
Database rollback uses the pre-release RDS snapshot or a forward migration.
During final cutover, Vercel and Neon remain available for at least seven days.
