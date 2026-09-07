# Infrastructure guide

Follow the root `AGENTS.md` unless this file is more specific. This tree is AWS Terraform for Rive in `ap-south-1`.

Read `infrastructure/README.md` before editing.

## Commands

- Inspect: `terraform -chdir=infrastructure/aws plan` after `terraform init` in that module, only if the user asked.
- Do not apply unless the user explicitly asked and a saved plan has been inspected.

## Rules

- Save and inspect a plan before any apply. Stop on destroy or replacement.
- Do not change public DNS. Terraform does not manage GoDaddy/Cloudflare cutover.
- Do not weaken private RDS, deletion protection, or the no-SSH posture.
- `dev` and `main` deploy from GitHub Actions after checks. Do not invent a side deploy path.
- Never commit `*.tfstate`, `*.tfplan`, or real `tfvars`.
- Prefer SSM Parameter Store and existing IAM/OIDC patterns over new access keys or SSH.
