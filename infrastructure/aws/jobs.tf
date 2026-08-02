data "archive_file" "job_runner" {
  type        = "zip"
  source_file = "${path.module}/lambda/job_runner.py"
  output_path = "${path.module}/.build/job_runner.zip"
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "job_runner" {
  name               = "rive-job-runner"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "job_runner_logs" {
  role       = aws_iam_role.job_runner.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "job_runner" {
  function_name    = "rive-job-runner"
  role             = aws_iam_role.job_runner.arn
  runtime          = "python3.13"
  handler          = "job_runner.handler"
  filename         = data.archive_file.job_runner.output_path
  source_code_hash = data.archive_file.job_runner.output_base64sha256
  timeout          = 90
  memory_size      = 128

  environment {
    variables = {
      PROD_APP_URL     = var.environment_domains.prod
      TEST_APP_URL     = var.environment_domains.test
      DEV_APP_URL      = var.environment_domains.dev
      PROD_CRON_SECRET = random_password.cron["prod"].result
      TEST_CRON_SECRET = random_password.cron["test"].result
      DEV_CRON_SECRET  = random_password.cron["dev"].result
    }
  }
}

resource "aws_cloudwatch_log_group" "job_runner" {
  name              = "/aws/lambda/${aws_lambda_function.job_runner.function_name}"
  retention_in_days = 14
}

locals {
  scheduled_jobs = {
    prod_sync = {
      expression = "rate(5 minutes)"
      targets = [
        { environment = "prod", path = "/api/calendar/sync-outbox" },
      ]
    }
    nonprod_sync = {
      expression = "rate(15 minutes)"
      targets = [
        { environment = "test", path = "/api/calendar/sync-outbox" },
        { environment = "dev", path = "/api/calendar/sync-outbox" },
      ]
    }
    maintenance = {
      expression = "rate(6 hours)"
      targets = [
        { environment = "prod", path = "/api/calendar/maintenance" },
        { environment = "test", path = "/api/calendar/maintenance" },
        { environment = "dev", path = "/api/calendar/maintenance" },
      ]
    }
    contract_billing = {
      expression = "rate(15 minutes)"
      targets = [
        { environment = "prod", path = "/api/contracts/maintenance" },
        { environment = "test", path = "/api/contracts/maintenance" },
        { environment = "dev", path = "/api/contracts/maintenance" },
      ]
    }
  }
}

resource "aws_cloudwatch_event_rule" "jobs" {
  for_each            = local.scheduled_jobs
  name                = "rive-${replace(each.key, "_", "-")}"
  schedule_expression = each.value.expression
  state               = each.key == "contract_billing" ? (var.contract_billing_jobs_enabled ? "ENABLED" : "DISABLED") : (var.scheduled_jobs_enabled ? "ENABLED" : "DISABLED")
}

resource "aws_cloudwatch_event_target" "jobs" {
  for_each = local.scheduled_jobs
  rule     = aws_cloudwatch_event_rule.jobs[each.key].name
  arn      = aws_lambda_function.job_runner.arn
  input    = jsonencode({ targets = each.value.targets })
}

resource "aws_lambda_permission" "eventbridge" {
  for_each      = local.scheduled_jobs
  statement_id  = "AllowEventBridge-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.job_runner.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.jobs[each.key].arn
}

resource "aws_sqs_queue" "migration_dead_letter" {
  for_each                  = local.environments
  name                      = "rive-${each.key}-migration-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "migration" {
  for_each                   = local.environments
  name                       = "rive-${each.key}-migration"
  visibility_timeout_seconds = 900
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 20
  sqs_managed_sse_enabled    = true
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.migration_dead_letter[each.key].arn
    maxReceiveCount     = 5
  })
}

resource "aws_cloudwatch_metric_alarm" "migration_dead_letters" {
  for_each            = local.environments
  alarm_name          = "rive-${each.key}-migration-dead-letters"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "A Rive migration job exhausted its retries."
  dimensions          = { QueueName = aws_sqs_queue.migration_dead_letter[each.key].name }
}
