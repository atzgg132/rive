resource "random_password" "session" {
  for_each = local.environments
  length   = 48
  special  = false
}

resource "random_password" "calendar" {
  for_each = local.environments
  length   = 48
  special  = false
}

resource "random_password" "cron" {
  for_each = local.environments
  length   = 48
  special  = false
}

locals {
  environment_parameters = merge([
    for environment in local.environments : {
      "${environment}/APP_ENV"                          = environment
      "${environment}/APP_URL"                          = var.environment_domains[environment]
      "${environment}/AWS_REGION"                       = var.aws_region
      "${environment}/DATABASE_POOL_MAX"                = environment == "prod" ? "12" : "4"
      "${environment}/DATABASE_SSL_REJECT_UNAUTHORIZED" = "true"
      "${environment}/SESSION_SECRET"                   = random_password.session[environment].result
      "${environment}/CALENDAR_ENCRYPTION_KEY"          = random_password.calendar[environment].result
      "${environment}/CRON_SECRET"                      = random_password.cron[environment].result
      "${environment}/CONTRACTS_ENABLED"                = "true"
      "${environment}/ESIGN_PROVIDER"                   = "rive"
      # Keep the alpha recorded-acceptance workflow available in every
      # deployed environment so dev does not silently diverge from the
      # public product structure. The local/demo provider remains rejected by
      # the application in production.
      "${environment}/CONTRACTS_RECORDED_ACCEPTANCE_ENABLED"        = "true"
      "${environment}/CONTRACTS_ALLOW_LOCAL_PROVIDER_IN_PRODUCTION" = "false"
      "${environment}/MIGRATION_ENGINE_ENABLED"                     = "false"
      "${environment}/GOOGLE_CALENDAR_ENABLED"                      = environment == "dev" ? "true" : "false"
      "${environment}/ZOHO_BOOKS_ENABLED"                           = "false"
      "${environment}/ZOHO_ACCOUNTS_URL"                            = "https://accounts.zoho.in"
      "${environment}/EMAIL_PROVIDER"                               = environment == "prod" ? var.email_provider : "disabled"
      "${environment}/EMAIL_FROM"                                   = "\"rive.\" <hello@${var.domain_name}>"
      "${environment}/EMAIL_REPLY_TO"                               = "hello@${var.domain_name}"
      "${environment}/SMTP_HOST"                                    = var.smtp_host
      "${environment}/SMTP_PORT"                                    = tostring(var.smtp_port)
      "${environment}/SMTP_SECURE"                                  = tostring(var.smtp_secure)
      "${environment}/SMTP_USER"                                    = var.smtp_user
      "${environment}/SES_CONFIGURATION_SET"                        = aws_sesv2_configuration_set.transactional.configuration_set_name
      "${environment}/ASSET_BUCKET"                                 = aws_s3_bucket.assets[environment].id
      "${environment}/MIGRATION_QUEUE_URL"                          = aws_sqs_queue.migration[environment].url
      "${environment}/MAX_UPLOAD_BYTES"                             = "10485760"
      # Ceiling for portfolio video. Per-format caps live in the application so
      # they can be tuned without a deploy; this is the hard upper bound.
      "${environment}/MAX_MEDIA_UPLOAD_BYTES" = "157286400"
      # Proxies in front of the app that append to X-Forwarded-For. Caddy runs
      # on this host and overwrites the header, so the app reads the rightmost
      # entry and a forged one cannot key a rate limit. Raise this only when a
      # CDN or load balancer is genuinely added in front of Caddy.
      "${environment}/TRUSTED_PROXY_HOPS" = "0"
    }
  ]...)

  # These credentials are set and rotated directly in SSM by an operator. The
  # configured values are bootstrap-only fallbacks for a genuinely new stack;
  # once imported, Terraform must preserve the live values.
  operator_managed_parameters = {
    "dev/GOOGLE_CALENDAR_CLIENT_ID"      = var.google_calendar_client_id
    "dev/GOOGLE_CALENDAR_CLIENT_SECRET"  = var.google_calendar_client_secret
    "dev/SMTP_PASS"                      = "DISABLED"
    "dev/ZOHO_BOOKS_CLIENT_ID"           = var.zoho_books_client_id
    "dev/ZOHO_BOOKS_CLIENT_SECRET"       = var.zoho_books_client_secret
    "prod/GOOGLE_CALENDAR_CLIENT_ID"     = var.google_calendar_client_id
    "prod/GOOGLE_CALENDAR_CLIENT_SECRET" = var.google_calendar_client_secret
    "prod/SMTP_PASS"                     = var.smtp_password
    "prod/ZOHO_BOOKS_CLIENT_ID"          = var.zoho_books_client_id
    "prod/ZOHO_BOOKS_CLIENT_SECRET"      = var.zoho_books_client_secret
  }
}

resource "aws_ssm_parameter" "environment" {
  for_each = local.environment_parameters
  name     = "/rive/${each.key}"
  type     = can(regex("SECRET|PASSWORD|DATABASE|CALENDAR_ENCRYPTION", each.key)) ? "SecureString" : "String"
  value    = each.value
}

resource "aws_ssm_parameter" "operator_managed" {
  for_each = local.operator_managed_parameters
  name     = "/rive/${each.key}"
  type     = can(regex("SECRET|PASSWORD|_PASS$", each.key)) ? "SecureString" : "String"
  value    = each.value

  lifecycle {
    ignore_changes = [value]
  }
}

# Preserve the existing state identities while moving credentials out of the
# general environment-parameter collection.
#
# Every key in operator_managed_parameters that previously lived in
# environment_parameters needs a block here, for both environments. Without
# one, Terraform cannot correlate the old and new addresses and plans a
# destroy-then-create against the same SSM name. `ignore_changes = [value]`
# does not save it: that only suppresses drift against a prior state, and a
# create has none — so the new parameter is written with whatever the TF_VAR
# happens to be, which is empty once an operator has cleared it. That would
# silently overwrite the rotated production SMTP password and the Zoho OAuth
# credentials, breaking transactional email and the Zoho Books connection.
moved {
  from = aws_ssm_parameter.environment["dev/GOOGLE_CALENDAR_CLIENT_ID"]
  to   = aws_ssm_parameter.operator_managed["dev/GOOGLE_CALENDAR_CLIENT_ID"]
}

moved {
  from = aws_ssm_parameter.environment["dev/GOOGLE_CALENDAR_CLIENT_SECRET"]
  to   = aws_ssm_parameter.operator_managed["dev/GOOGLE_CALENDAR_CLIENT_SECRET"]
}

moved {
  from = aws_ssm_parameter.environment["prod/GOOGLE_CALENDAR_CLIENT_ID"]
  to   = aws_ssm_parameter.operator_managed["prod/GOOGLE_CALENDAR_CLIENT_ID"]
}

moved {
  from = aws_ssm_parameter.environment["prod/GOOGLE_CALENDAR_CLIENT_SECRET"]
  to   = aws_ssm_parameter.operator_managed["prod/GOOGLE_CALENDAR_CLIENT_SECRET"]
}

moved {
  from = aws_ssm_parameter.environment["dev/SMTP_PASS"]
  to   = aws_ssm_parameter.operator_managed["dev/SMTP_PASS"]
}

moved {
  from = aws_ssm_parameter.environment["dev/ZOHO_BOOKS_CLIENT_ID"]
  to   = aws_ssm_parameter.operator_managed["dev/ZOHO_BOOKS_CLIENT_ID"]
}

moved {
  from = aws_ssm_parameter.environment["dev/ZOHO_BOOKS_CLIENT_SECRET"]
  to   = aws_ssm_parameter.operator_managed["dev/ZOHO_BOOKS_CLIENT_SECRET"]
}

moved {
  from = aws_ssm_parameter.environment["prod/SMTP_PASS"]
  to   = aws_ssm_parameter.operator_managed["prod/SMTP_PASS"]
}

moved {
  from = aws_ssm_parameter.environment["prod/ZOHO_BOOKS_CLIENT_ID"]
  to   = aws_ssm_parameter.operator_managed["prod/ZOHO_BOOKS_CLIENT_ID"]
}

moved {
  from = aws_ssm_parameter.environment["prod/ZOHO_BOOKS_CLIENT_SECRET"]
  to   = aws_ssm_parameter.operator_managed["prod/ZOHO_BOOKS_CLIENT_SECRET"]
}

resource "aws_ssm_parameter" "admin_password_hash" {
  for_each    = local.environments
  name        = "/rive/${each.key}/ADMIN_PASSWORD_HASH"
  type        = "SecureString"
  value       = var.admin_password_hash
  description = "Admin portal password hash (scrypt). Generate with: node scripts/setup-admin.mjs"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "admin_username" {
  for_each    = local.environments
  name        = "/rive/${each.key}/ADMIN_USERNAME"
  type        = "String"
  value       = var.admin_username
  description = "Admin portal username. Change manually in SSM after bootstrap."

  lifecycle {
    ignore_changes = [value]
  }
}
