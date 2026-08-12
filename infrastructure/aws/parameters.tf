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
      # Production uses Rive's first-party recorded-acceptance adapter. The
      # local/demo provider remains rejected by the application in production.
      "${environment}/CONTRACTS_RECORDED_ACCEPTANCE_ENABLED"        = environment == "prod" ? "true" : "false"
      "${environment}/CONTRACTS_ALLOW_LOCAL_PROVIDER_IN_PRODUCTION" = "false"
      "${environment}/GOOGLE_CALENDAR_ENABLED"                      = "false"
      "${environment}/GOOGLE_CALENDAR_CLIENT_ID"                    = var.google_calendar_client_id
      "${environment}/GOOGLE_CALENDAR_CLIENT_SECRET"                = var.google_calendar_client_secret
      "${environment}/ZOHO_BOOKS_ENABLED"                           = "false"
      "${environment}/ZOHO_BOOKS_CLIENT_ID"                         = var.zoho_books_client_id
      "${environment}/ZOHO_BOOKS_CLIENT_SECRET"                     = var.zoho_books_client_secret
      "${environment}/ZOHO_ACCOUNTS_URL"                            = "https://accounts.zoho.in"
      "${environment}/EMAIL_PROVIDER"                               = environment == "prod" ? var.email_provider : "disabled"
      "${environment}/EMAIL_FROM"                                   = "\"rive.\" <hello@${var.domain_name}>"
      "${environment}/EMAIL_REPLY_TO"                               = "hello@${var.domain_name}"
      "${environment}/SMTP_HOST"                                    = "smtppro.zoho.in"
      "${environment}/SMTP_PORT"                                    = "465"
      "${environment}/SMTP_SECURE"                                  = "true"
      "${environment}/SMTP_USER"                                    = var.zoho_smtp_user
      "${environment}/SMTP_PASS"                                    = environment == "prod" ? var.zoho_smtp_password : "DISABLED"
      "${environment}/SES_CONFIGURATION_SET"                        = aws_sesv2_configuration_set.transactional.configuration_set_name
      "${environment}/ASSET_BUCKET"                                 = aws_s3_bucket.assets[environment].id
      "${environment}/MIGRATION_QUEUE_URL"                          = aws_sqs_queue.migration[environment].url
      "${environment}/MAX_UPLOAD_BYTES"                             = "10485760"
    }
  ]...)
}

resource "aws_ssm_parameter" "environment" {
  for_each = local.environment_parameters
  name     = "/rive/${each.key}"
  type     = can(regex("SECRET|PASSWORD|DATABASE|CALENDAR_ENCRYPTION", each.key)) ? "SecureString" : "String"
  value    = each.value
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
