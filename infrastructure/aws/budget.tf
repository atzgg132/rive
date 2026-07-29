resource "aws_budgets_budget" "monthly" {
  name         = "rive-monthly-cost"
  budget_type  = "COST"
  limit_amount = "40"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "Region"
    values = [var.aws_region, "global"]
  }

  dynamic "notification" {
    for_each = toset(["50", "75", "90", "100"])
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = tonumber(notification.value)
      threshold_type             = "PERCENTAGE"
      notification_type          = "FORECASTED"
      subscriber_email_addresses = [var.billing_alert_email]
    }
  }
}
