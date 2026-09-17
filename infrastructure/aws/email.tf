resource "aws_sesv2_email_identity" "domain" {
  email_identity = var.domain_name
}

resource "aws_sesv2_configuration_set" "transactional" {
  configuration_set_name = "rive-transactional"

  reputation_options {
    reputation_metrics_enabled = true
  }

  sending_options {
    sending_enabled = true
  }
}

resource "aws_sns_topic" "email_events" {
  name = "rive-email-events"
}

resource "aws_sesv2_configuration_set_event_destination" "events" {
  configuration_set_name = aws_sesv2_configuration_set.transactional.configuration_set_name
  event_destination_name = "rive-email-events"

  event_destination {
    enabled              = true
    matching_event_types = ["BOUNCE", "COMPLAINT", "DELIVERY", "REJECT"]

    sns_destination {
      topic_arn = aws_sns_topic.email_events.arn
    }
  }
}

resource "aws_sns_topic_subscription" "email_events_job_runner" {
  topic_arn = aws_sns_topic.email_events.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.job_runner.arn
}

resource "aws_lambda_permission" "email_events" {
  statement_id  = "AllowSesEmailEvents"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.job_runner.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.email_events.arn
}
