output "application_public_ip" {
  value       = aws_eip.app.public_ip
  description = "Create Cloudflare A records for @, www, and dev using this address."
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}

output "rds_endpoint" {
  value = aws_db_instance.postgres.address
}

output "ses_verification_records" {
  value = {
    dkim_tokens = aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens
  }
}

output "operator_role_arns" {
  description = "Human-assumable roles. All require MFA within the last hour."
  value = {
    readonly      = aws_iam_role.operator_readonly.arn
    deploy        = aws_iam_role.deploy_operator.arn
    db_diagnostic = aws_iam_role.db_diagnostic.arn
    break_glass   = aws_iam_role.break_glass.arn
  }
}

output "audit_trail" {
  description = "Multi-region CloudTrail and private log bucket."
  value = {
    trail_arn = aws_cloudtrail.operations.arn
    bucket    = aws_s3_bucket.cloudtrail.bucket
  }
}
