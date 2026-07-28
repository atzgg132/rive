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
      "${environment}/GOOGLE_CALENDAR_CLIENT_ID"        = var.google_calendar_client_id
      "${environment}/GOOGLE_CALENDAR_CLIENT_SECRET"    = var.google_calendar_client_secret
      "${environment}/EMAIL_PROVIDER"                   = environment == "prod" ? "ses" : "disabled"
      "${environment}/EMAIL_FROM"                       = "\"rive.\" <hello@${var.domain_name}>"
      "${environment}/EMAIL_REPLY_TO"                   = "hello@${var.domain_name}"
      "${environment}/SES_CONFIGURATION_SET"            = aws_sesv2_configuration_set.transactional.configuration_set_name
      "${environment}/ASSET_BUCKET"                     = aws_s3_bucket.assets[environment].id
      "${environment}/MAX_UPLOAD_BYTES"                 = "10485760"
    }
  ]...)
}

resource "aws_ssm_parameter" "environment" {
  for_each = local.environment_parameters
  name     = "/rive/${each.key}"
  type     = can(regex("SECRET|PASSWORD|DATABASE|CALENDAR_ENCRYPTION", each.key)) ? "SecureString" : "String"
  value    = each.value
}
