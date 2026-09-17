# Human operator roles. Every role requires a recent MFA session and is assumed
# from the account root, so any IAM principal in the account can take the role
# only with an MFA-authenticated session no older than one hour.

data "aws_iam_policy_document" "operator_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    condition {
      test     = "Bool"
      variable = "aws:MultiFactorAuthPresent"
      values   = ["true"]
    }
    condition {
      test     = "NumericLessThan"
      variable = "aws:MultiFactorAuthAge"
      values   = ["3600"]
    }
  }
}

resource "aws_iam_role" "operator_readonly" {
  name                 = "rive-operator-readonly"
  assume_role_policy   = data.aws_iam_policy_document.operator_assume.json
  max_session_duration = 3600
}

data "aws_iam_policy_document" "operator_readonly" {
  statement {
    sid = "ReadOperationalState"
    actions = [
      "cloudwatch:Describe*",
      "cloudwatch:Get*",
      "cloudwatch:List*",
      "ec2:Describe*",
      "ecr:BatchGetImage",
      "ecr:Describe*",
      "ecr:List*",
      "events:Describe*",
      "events:List*",
      "lambda:Get*",
      "lambda:List*",
      "logs:Describe*",
      "logs:FilterLogEvents",
      "logs:Get*",
      "logs:StartQuery",
      "logs:StopQuery",
      "rds:Describe*",
      "rds:ListTagsForResource",
      "route53:Get*",
      "route53:List*",
      "s3:GetBucket*",
      "s3:List*",
      "ses:Get*",
      "ses:List*",
      "sns:Get*",
      "sns:List*",
      "sqs:Get*",
      "sqs:List*",
      "ssm:Describe*",
      "ssm:GetCommandInvocation",
      "ssm:ListCommandInvocations",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "operator_readonly" {
  name   = "rive-readonly"
  role   = aws_iam_role.operator_readonly.id
  policy = data.aws_iam_policy_document.operator_readonly.json
}

# Same permissions GitHub Actions deploys with, for an operator running the
# deploy path by hand.
resource "aws_iam_role" "deploy_operator" {
  name                 = "rive-deploy-operator"
  assume_role_policy   = data.aws_iam_policy_document.operator_assume.json
  max_session_duration = 3600
}

resource "aws_iam_role_policy" "deploy_operator" {
  name   = "rive-deploy"
  role   = aws_iam_role.deploy_operator.id
  policy = data.aws_iam_policy_document.github_deploy.json
}

# Read-only diagnostics plus an SSM port-forward to reach the private database.
resource "aws_iam_role" "db_diagnostic" {
  name                 = "rive-db-diagnostic"
  assume_role_policy   = data.aws_iam_policy_document.operator_assume.json
  max_session_duration = 3600
}

data "aws_iam_policy_document" "db_diagnostic" {
  statement {
    sid = "ReadDatabaseTelemetry"
    actions = [
      "rds:Describe*",
      "rds:ListTagsForResource",
      "cloudwatch:Describe*",
      "cloudwatch:Get*",
      "cloudwatch:List*",
      "logs:Describe*",
      "logs:Get*",
      "logs:FilterLogEvents",
      "logs:StartQuery",
      "logs:StopQuery",
    ]
    resources = ["*"]
  }

  statement {
    sid     = "StartDatabaseTunnel"
    actions = ["ssm:StartSession"]
    resources = [
      aws_instance.app.arn,
      "arn:aws:ssm:${var.aws_region}::document/AWS-StartPortForwardingSession",
      "arn:aws:ssm:${var.aws_region}::document/AWS-StartPortForwardingSessionToRemoteHost",
    ]
  }

  statement {
    sid     = "ManageOwnSessions"
    actions = ["ssm:TerminateSession", "ssm:ResumeSession"]
    resources = [
      "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:session/$${aws:username}-*"
    ]
  }

  statement {
    sid = "DiscoverSessionTargets"
    actions = [
      "ssm:DescribeSessions",
      "ssm:GetConnectionStatus",
      "ssm:DescribeInstanceInformation",
      "ssm:DescribeInstanceProperties",
      "ec2:DescribeInstances",
    ]
    resources = ["*"]
  }

  statement {
    sid = "ReadRuntimeParameters"
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParametersByPath",
    ]
    resources = [
      "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/rive/*/DATABASE_URL",
    ]
  }
}

resource "aws_iam_role_policy" "db_diagnostic" {
  name   = "rive-db-diagnostic"
  role   = aws_iam_role.db_diagnostic.id
  policy = data.aws_iam_policy_document.db_diagnostic.json
}

resource "aws_iam_role" "break_glass" {
  name                 = "rive-break-glass"
  assume_role_policy   = data.aws_iam_policy_document.operator_assume.json
  max_session_duration = 3600
}

resource "aws_iam_role_policy_attachment" "break_glass" {
  role       = aws_iam_role.break_glass.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}
