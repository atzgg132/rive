# Operational alerting and central log plumbing.
#
# Every alarm funnels into one SNS topic per region. Route53 health-check
# metrics live only in us-east-1, and CloudWatch alarm actions cannot cross
# regions, so a mirrored topic exists there for the public-readiness alarms.
# Email subscribers must confirm the subscription once after the first apply.

resource "aws_sns_topic" "operations" {
  name = "rive-operations-alerts"
}

resource "aws_sns_topic_subscription" "operations_email" {
  topic_arn = aws_sns_topic.operations.arn
  protocol  = "email"
  endpoint  = var.billing_alert_email
}

data "aws_iam_policy_document" "operations_topic" {
  statement {
    sid = "AllowAccountOwner"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions = [
      "sns:GetTopicAttributes",
      "sns:SetTopicAttributes",
      "sns:AddPermission",
      "sns:RemovePermission",
      "sns:DeleteTopic",
      "sns:Subscribe",
      "sns:ListSubscriptionsByTopic",
      "sns:Publish",
    ]
    resources = [aws_sns_topic.operations.arn]
  }

  statement {
    sid = "AllowServicePublishers"
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com", "cloudwatch.amazonaws.com"]
    }
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.operations.arn]
  }
}

resource "aws_sns_topic_policy" "operations" {
  arn    = aws_sns_topic.operations.arn
  policy = data.aws_iam_policy_document.operations_topic.json
}

resource "aws_sns_topic" "operations_us_east_1" {
  provider = aws.us_east_1
  name     = "rive-operations-alerts"
}

resource "aws_sns_topic_subscription" "operations_email_us_east_1" {
  provider  = aws.us_east_1
  topic_arn = aws_sns_topic.operations_us_east_1.arn
  protocol  = "email"
  endpoint  = var.billing_alert_email
}

data "aws_iam_policy_document" "operations_topic_us_east_1" {
  statement {
    sid = "AllowAccountOwner"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions = [
      "sns:GetTopicAttributes",
      "sns:SetTopicAttributes",
      "sns:AddPermission",
      "sns:RemovePermission",
      "sns:DeleteTopic",
      "sns:Subscribe",
      "sns:ListSubscriptionsByTopic",
      "sns:Publish",
    ]
    resources = [aws_sns_topic.operations_us_east_1.arn]
  }

  statement {
    sid = "AllowServicePublishers"
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.operations_us_east_1.arn]
  }
}

resource "aws_sns_topic_policy" "operations_us_east_1" {
  provider = aws.us_east_1
  arn      = aws_sns_topic.operations_us_east_1.arn
  policy   = data.aws_iam_policy_document.operations_topic_us_east_1.json
}

locals {
  ops_alarm_actions    = [aws_sns_topic.operations.arn]
  ops_alarm_actions_e1 = [aws_sns_topic.operations_us_east_1.arn]
}

# --- Job runner and scheduler ------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "job_runner_errors" {
  alarm_name          = "rive-job-runner-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_description   = "The scheduled Rive job runner is failing invocations."
  dimensions          = { FunctionName = aws_lambda_function.job_runner.function_name }
  alarm_actions       = local.ops_alarm_actions
  ok_actions          = local.ops_alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "job_runner_throttles" {
  alarm_name          = "rive-job-runner-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_description   = "The scheduled Rive job runner is being throttled."
  dimensions          = { FunctionName = aws_lambda_function.job_runner.function_name }
  alarm_actions       = local.ops_alarm_actions
  ok_actions          = local.ops_alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "job_runner_duration" {
  alarm_name          = "rive-job-runner-slow"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  extended_statistic  = "p95"
  threshold           = 300000
  treat_missing_data  = "notBreaching"
  alarm_description   = "The job runner p95 duration exceeds 300s; the migration worker call is near its 310s timeout."
  dimensions          = { FunctionName = aws_lambda_function.job_runner.function_name }
  alarm_actions       = local.ops_alarm_actions
  ok_actions          = local.ops_alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "job_rule_failures" {
  for_each            = local.scheduled_jobs
  alarm_name          = "rive-${replace(each.key, "_", "-")}-rule-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FailedInvocations"
  namespace           = "AWS/Events"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_description   = "EventBridge could not invoke the job runner for the rive-${replace(each.key, "_", "-")} schedule."
  dimensions          = { RuleName = aws_cloudwatch_event_rule.jobs[each.key].name }
  alarm_actions       = local.ops_alarm_actions
  ok_actions          = local.ops_alarm_actions
}

# --- Host --------------------------------------------------------------------
#
# disk/memory/swap come from the CloudWatch agent and ContainerRestarts from a
# cron-driven monitor; both are installed by the bootstrap. Their alarms also
# fire on missing data because silence means the telemetry path itself is down.

resource "aws_cloudwatch_metric_alarm" "instance_status_check" {
  alarm_name                = "rive-instance-status-check"
  comparison_operator       = "GreaterThanThreshold"
  evaluation_periods        = 1
  metric_name               = "StatusCheckFailed"
  namespace                 = "AWS/EC2"
  period                    = 300
  statistic                 = "Maximum"
  threshold                 = 0
  alarm_description         = "The Rive host is failing an EC2 status check."
  dimensions                = { InstanceId = aws_instance.app.id }
  alarm_actions             = local.ops_alarm_actions
  ok_actions                = local.ops_alarm_actions
  insufficient_data_actions = local.ops_alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "instance_disk" {
  alarm_name                = "rive-instance-disk-high"
  comparison_operator       = "GreaterThanThreshold"
  evaluation_periods        = 2
  metric_name               = "disk_used_percent"
  namespace                 = "CWAgent"
  period                    = 300
  statistic                 = "Average"
  threshold                 = 80
  alarm_description         = "The Rive host root filesystem is above 80% used."
  dimensions                = { InstanceId = aws_instance.app.id }
  alarm_actions             = local.ops_alarm_actions
  ok_actions                = local.ops_alarm_actions
  insufficient_data_actions = local.ops_alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "instance_memory" {
  alarm_name                = "rive-instance-memory-high"
  comparison_operator       = "GreaterThanThreshold"
  evaluation_periods        = 2
  metric_name               = "mem_used_percent"
  namespace                 = "CWAgent"
  period                    = 300
  statistic                 = "Average"
  threshold                 = 85
  alarm_description         = "The Rive host memory is above 85% used."
  dimensions                = { InstanceId = aws_instance.app.id }
  alarm_actions             = local.ops_alarm_actions
  ok_actions                = local.ops_alarm_actions
  insufficient_data_actions = local.ops_alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "instance_swap" {
  alarm_name                = "rive-instance-swap-high"
  comparison_operator       = "GreaterThanThreshold"
  evaluation_periods        = 2
  metric_name               = "swap_used_percent"
  namespace                 = "CWAgent"
  period                    = 300
  statistic                 = "Average"
  threshold                 = 50
  alarm_description         = "The Rive host swap is above 50% used; memory pressure is sustained."
  dimensions                = { InstanceId = aws_instance.app.id }
  alarm_actions             = local.ops_alarm_actions
  ok_actions                = local.ops_alarm_actions
  insufficient_data_actions = local.ops_alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "container_restarts" {
  alarm_name                = "rive-container-restarts"
  comparison_operator       = "GreaterThanThreshold"
  evaluation_periods        = 1
  metric_name               = "ContainerRestarts"
  namespace                 = "Rive/Host"
  period                    = 300
  statistic                 = "Sum"
  threshold                 = 0
  alarm_description         = "A long-running Rive container restarted on the host."
  dimensions                = { InstanceId = aws_instance.app.id }
  alarm_actions             = local.ops_alarm_actions
  ok_actions                = local.ops_alarm_actions
  insufficient_data_actions = local.ops_alarm_actions
}

# --- Database ----------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name                = "rive-database-high-cpu"
  comparison_operator       = "GreaterThanThreshold"
  evaluation_periods        = 3
  metric_name               = "CPUUtilization"
  namespace                 = "AWS/RDS"
  period                    = 300
  statistic                 = "Average"
  threshold                 = 80
  alarm_description         = "Rive PostgreSQL CPU has exceeded 80% for 15 minutes."
  dimensions                = { DBInstanceIdentifier = aws_db_instance.postgres.identifier }
  alarm_actions             = local.ops_alarm_actions
  ok_actions                = local.ops_alarm_actions
  insufficient_data_actions = local.ops_alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  alarm_name                = "rive-database-connections-high"
  comparison_operator       = "GreaterThanThreshold"
  evaluation_periods        = 2
  metric_name               = "DatabaseConnections"
  namespace                 = "AWS/RDS"
  period                    = 300
  statistic                 = "Average"
  threshold                 = 80
  alarm_description         = "Rive PostgreSQL connections exceed 80 for 10 minutes."
  dimensions                = { DBInstanceIdentifier = aws_db_instance.postgres.identifier }
  alarm_actions             = local.ops_alarm_actions
  ok_actions                = local.ops_alarm_actions
  insufficient_data_actions = local.ops_alarm_actions
}

# Failure, failover, and backup events have no CloudWatch metric; they arrive as
# EventBridge events, so they route straight to the alert topic.
resource "aws_cloudwatch_event_rule" "rds_events" {
  name        = "rive-rds-instance-events"
  description = "RDS failure and backup notifications for rive-postgres."
  event_pattern = jsonencode({
    source        = ["aws.rds"]
    "detail-type" = ["RDS DB Instance Event"]
    detail = {
      SourceArn       = [aws_db_instance.postgres.arn]
      EventCategories = ["availability", "backup", "failure", "failover", "low storage", "recovery"]
    }
  })
}

resource "aws_cloudwatch_event_target" "rds_events" {
  rule = aws_cloudwatch_event_rule.rds_events.name
  arn  = aws_sns_topic.operations.arn
}

# --- Public readiness ---------------------------------------------------------
#
# Route53 publishes health-check metrics only in us-east-1, so the alarms and
# their alert topic live behind the us_east_1 provider alias.

resource "aws_route53_health_check" "readiness" {
  for_each          = local.environments
  fqdn              = trimprefix(var.environment_domains[each.key], "https://")
  port              = 443
  type              = "HTTPS"
  resource_path     = "/api/ready"
  failure_threshold = 3
  request_interval  = 30

  tags = { Name = "rive-${each.key}-readiness" }
}

resource "aws_cloudwatch_metric_alarm" "public_readiness" {
  provider                  = aws.us_east_1
  for_each                  = local.environments
  alarm_name                = "rive-${each.key}-public-readiness"
  comparison_operator       = "LessThanThreshold"
  evaluation_periods        = 2
  metric_name               = "HealthCheckStatus"
  namespace                 = "AWS/Route53"
  period                    = 60
  statistic                 = "Minimum"
  threshold                 = 1
  alarm_description         = "https://${trimprefix(var.environment_domains[each.key], "https://")}/api/ready is failing Route53 health checks."
  dimensions                = { HealthCheckId = aws_route53_health_check.readiness[each.key].id }
  alarm_actions             = local.ops_alarm_actions_e1
  ok_actions                = local.ops_alarm_actions_e1
  insufficient_data_actions = local.ops_alarm_actions_e1
}

# --- Central logs -------------------------------------------------------------

resource "aws_cloudwatch_log_group" "app" {
  for_each          = local.environments
  name              = "/rive/app/${each.key}"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "proxy" {
  name              = "/rive/proxy"
  retention_in_days = 30
}

# Email-backlog telemetry. The application emits JSON log lines with top-level
# metricName/metricValue fields (src/utils/logger.ts logMetric); the filters
# lift them into CloudWatch. Missing data is deliberately not alarming here:
# until the app version that emits these fields is deployed, the metrics do
# not exist.
resource "aws_cloudwatch_log_metric_filter" "email_outbox_oldest_queued" {
  for_each       = local.environments
  name           = "rive-${each.key}-email-outbox-oldest-queued"
  log_group_name = aws_cloudwatch_log_group.app[each.key].name
  pattern        = "{ $.metricName = \"email_outbox_oldest_queued_seconds\" }"

  metric_transformation {
    name       = "email_outbox_oldest_queued_seconds"
    namespace  = "Rive/Application"
    value      = "$.metricValue"
    unit       = "Seconds"
    dimensions = { Environment = each.key }
  }
}

resource "aws_cloudwatch_log_metric_filter" "email_outbox_terminal_failures" {
  for_each       = local.environments
  name           = "rive-${each.key}-email-outbox-terminal-failures"
  log_group_name = aws_cloudwatch_log_group.app[each.key].name
  pattern        = "{ $.metricName = \"email_outbox_terminal_failures_last_hour\" }"

  metric_transformation {
    name       = "email_outbox_terminal_failures_last_hour"
    namespace  = "Rive/Application"
    value      = "$.metricValue"
    dimensions = { Environment = each.key }
  }
}

resource "aws_cloudwatch_log_metric_filter" "email_outbox_processing" {
  for_each       = local.environments
  name           = "rive-${each.key}-email-outbox-processing"
  log_group_name = aws_cloudwatch_log_group.app[each.key].name
  pattern        = "{ $.metricName = \"email_outbox_processing_count\" }"

  metric_transformation {
    name       = "email_outbox_processing_count"
    namespace  = "Rive/Application"
    value      = "$.metricValue"
    dimensions = { Environment = each.key }
  }
}

resource "aws_cloudwatch_metric_alarm" "email_outbox_oldest_queued" {
  for_each            = local.environments
  alarm_name          = "rive-${each.key}-email-outbox-oldest-queued"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "email_outbox_oldest_queued_seconds"
  namespace           = "Rive/Application"
  period              = 300
  statistic           = "Maximum"
  threshold           = 300
  treat_missing_data  = "notBreaching"
  alarm_description   = "The oldest queued ${each.key} outbox email has waited more than five minutes."
  dimensions          = { Environment = each.key }
  alarm_actions       = local.ops_alarm_actions
  ok_actions          = local.ops_alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "email_outbox_terminal_failures" {
  for_each            = local.environments
  alarm_name          = "rive-${each.key}-email-outbox-terminal-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "email_outbox_terminal_failures_last_hour"
  namespace           = "Rive/Application"
  period              = 300
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_description   = "A ${each.key} outbox email reached a terminal failure in the last hour."
  dimensions          = { Environment = each.key }
  alarm_actions       = local.ops_alarm_actions
  ok_actions          = local.ops_alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "email_outbox_processing" {
  for_each            = local.environments
  alarm_name          = "rive-${each.key}-email-outbox-processing"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "email_outbox_processing_count"
  namespace           = "Rive/Application"
  period              = 300
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_description   = "${each.key} outbox email rows have stayed in processing across three checks."
  dimensions          = { Environment = each.key }
  alarm_actions       = local.ops_alarm_actions
  ok_actions          = local.ops_alarm_actions
}

# Account audit trail. Role assumptions, SSM commands, parameter reads, and
# deploy API calls land in the private bucket with integrity validation on.
resource "aws_s3_bucket" "cloudtrail" {
  bucket = "rive-cloudtrail-${data.aws_caller_identity.current.account_id}-${var.aws_region}"
}

resource "aws_s3_bucket_public_access_block" "cloudtrail" {
  bucket                  = aws_s3_bucket.cloudtrail.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id
  rule {
    id     = "retain-audit-logs"
    status = "Enabled"
    expiration {
      days = 400
    }
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

data "aws_iam_policy_document" "cloudtrail_bucket" {
  statement {
    sid = "AllowCloudTrailAclCheck"
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    actions   = ["s3:GetBucketAcl"]
    resources = [aws_s3_bucket.cloudtrail.arn]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = ["arn:aws:cloudtrail:${var.aws_region}:${data.aws_caller_identity.current.account_id}:trail/rive-account-operations"]
    }
  }

  statement {
    sid = "AllowCloudTrailWrite"
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.cloudtrail.arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"]
    condition {
      test     = "StringEquals"
      variable = "s3:x-amz-acl"
      values   = ["bucket-owner-full-control"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = ["arn:aws:cloudtrail:${var.aws_region}:${data.aws_caller_identity.current.account_id}:trail/rive-account-operations"]
    }
  }
}

resource "aws_s3_bucket_policy" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id
  policy = data.aws_iam_policy_document.cloudtrail_bucket.json
}

resource "aws_cloudtrail" "operations" {
  name                          = "rive-account-operations"
  s3_bucket_name                = aws_s3_bucket.cloudtrail.id
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_log_file_validation    = true
  enable_logging                = true

  depends_on = [aws_s3_bucket_policy.cloudtrail]
}
