resource "aws_db_subnet_group" "main" {
  name       = "rive"
  subnet_ids = aws_subnet.database[*].id
}

resource "aws_db_instance" "postgres" {
  identifier                      = "rive-postgres"
  engine                          = "postgres"
  engine_version                  = "17.6"
  instance_class                  = var.db_instance_class
  allocated_storage               = 20
  max_allocated_storage           = 50
  storage_type                    = "gp3"
  storage_encrypted               = true
  db_name                         = "rive_admin"
  username                        = "rive_admin"
  manage_master_user_password     = true
  publicly_accessible             = false
  multi_az                        = false
  db_subnet_group_name            = aws_db_subnet_group.main.name
  vpc_security_group_ids          = [aws_security_group.database.id]
  backup_retention_period         = 7
  backup_window                   = "18:30-19:30"
  maintenance_window              = "sun:19:30-sun:20:30"
  auto_minor_version_upgrade      = true
  deletion_protection             = true
  skip_final_snapshot             = false
  final_snapshot_identifier       = "rive-postgres-final"
  performance_insights_enabled    = false
  monitoring_interval             = 0
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  lifecycle {
    prevent_destroy = true
  }
}

resource "random_password" "database" {
  for_each = local.environments
  length   = 32
  special  = false
}

resource "aws_ssm_parameter" "database_password" {
  for_each = local.environments
  name     = "/rive/${each.key}/DB_PASSWORD"
  type     = "SecureString"
  value    = random_password.database[each.key].result
}

resource "aws_ssm_parameter" "database_url" {
  for_each = local.environments
  name     = "/rive/${each.key}/DATABASE_URL"
  type     = "SecureString"
  value    = "postgresql://rive_${each.key}:${random_password.database[each.key].result}@${aws_db_instance.postgres.address}:5432/rive_${each.key}?sslmode=require"
}
