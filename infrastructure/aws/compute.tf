data "aws_ssm_parameter" "amazon_linux_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

resource "aws_instance" "app" {
  ami                         = data.aws_ssm_parameter.amazon_linux_arm64.value
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.app.id]
  iam_instance_profile        = aws_iam_instance_profile.app.name
  associate_public_ip_address = true
  user_data_replace_on_change = true

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    encrypted   = true
    volume_type = "gp3"
    volume_size = 16
  }

  user_data = templatefile("${path.module}/templates/bootstrap.sh.tftpl", {
    region           = var.aws_region
    account_id       = data.aws_caller_identity.current.account_id
    repository_url   = aws_ecr_repository.app.repository_url
    db_endpoint      = aws_db_instance.postgres.address
    db_master_secret = aws_db_instance.postgres.master_user_secret[0].secret_arn
    prod_hostname    = local.hostnames.prod
    dev_hostname     = local.hostnames.dev
    prod_memory      = local.memory_limits.prod
    dev_memory       = local.memory_limits.dev
  })

  depends_on = [
    aws_ssm_parameter.database_password,
    aws_ssm_parameter.database_url,
    aws_iam_role_policy.app,
  ]

  # This host is a pet, not cattle: releases reach it through SSM and Docker, and
  # Caddy's certificates plus /opt/rive live on its root volume. Without these
  # ignores Terraform replaces the running production server whenever Amazon
  # publishes a new Amazon Linux image behind the SSM alias, or whenever the
  # bootstrap template changes — an outage nobody asked for, triggered by an
  # unrelated apply.
  #
  # Rebuilding the box is therefore a deliberate act. To roll a new AMI or a new
  # bootstrap script, drop the matching entry here (or run
  # `terraform apply -replace=aws_instance.app`) during a planned window, and
  # expect Caddy to re-issue certificates on first boot.
  lifecycle {
    ignore_changes = [ami, user_data]
  }

  tags = {
    Name = "rive-app"
  }
}

resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app.id
  tags     = { Name = "rive-app" }
}

resource "aws_cloudwatch_metric_alarm" "instance_cpu" {
  alarm_name          = "rive-instance-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Rive application CPU has exceeded 80% for 15 minutes."
  dimensions          = { InstanceId = aws_instance.app.id }
}

resource "aws_cloudwatch_metric_alarm" "database_storage" {
  alarm_name          = "rive-database-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 5368709120
  alarm_description   = "Rive PostgreSQL has less than 5 GiB free."
  dimensions          = { DBInstanceIdentifier = aws_db_instance.postgres.id }
}
