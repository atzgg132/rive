data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "assets" {
  for_each = local.environments
  bucket   = "rive-${each.key}-assets-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "assets" {
  for_each                = local.environments
  bucket                  = aws_s3_bucket.assets[each.key].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  for_each = local.environments
  bucket   = aws_s3_bucket.assets[each.key].id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "assets" {
  for_each = local.environments
  bucket   = aws_s3_bucket.assets[each.key].id
  versioning_configuration {
    status = each.key == "prod" ? "Enabled" : "Suspended"
  }
}

resource "aws_s3_bucket_cors_configuration" "assets" {
  for_each = local.environments
  bucket   = aws_s3_bucket.assets[each.key].id
  cors_rule {
    allowed_headers = ["content-type"]
    allowed_methods = ["PUT"]
    allowed_origins = [var.environment_domains[each.key]]
    expose_headers  = ["etag"]
    max_age_seconds = 300
  }
}

# Portfolio media is the only user-controlled input that can grow the bill
# without a code change. The account budget alarm reports after the money is
# spent; this reports while it is still a trend.
resource "aws_cloudwatch_metric_alarm" "asset_bucket_size" {
  for_each            = local.environments
  alarm_name          = "rive-${each.key}-asset-bucket-size"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BucketSizeBytes"
  namespace           = "AWS/S3"
  period              = 86400
  statistic           = "Average"
  # 50 GB is roughly 100 accounts at the per-account media quota.
  threshold          = 53687091200
  treat_missing_data = "notBreaching"
  alarm_description  = "Portfolio asset storage is growing faster than expected. Check the sweeper and the per-account quota."

  dimensions = {
    BucketName  = aws_s3_bucket.assets[each.key].id
    StorageType = "StandardStorage"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "assets" {
  for_each = local.environments
  bucket   = aws_s3_bucket.assets[each.key].id

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }

  rule {
    id     = "expire-noncurrent"
    status = "Enabled"
    noncurrent_version_expiration {
      noncurrent_days = each.key == "prod" ? 30 : 7
    }
  }
}
