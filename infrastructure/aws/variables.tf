variable "aws_region" {
  type        = string
  description = "Primary AWS region. Rive remains in India."
  default     = "ap-south-1"

  validation {
    condition     = contains(["ap-south-1", "ap-south-2"], var.aws_region)
    error_message = "Rive infrastructure must remain in ap-south-1 or ap-south-2."
  }
}

variable "domain_name" {
  type    = string
  default = "rive.work"
}

variable "github_repository" {
  type    = string
  default = "atzgg132/rive"
}

variable "billing_alert_email" {
  type        = string
  description = "Email that receives AWS budget alerts."
}

variable "instance_type" {
  type    = string
  default = "t4g.small"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "google_calendar_client_id" {
  type        = string
  sensitive   = true
  default     = "UNCONFIGURED"
  description = "Google OAuth client ID. Replace after callback domains exist."
}

variable "google_calendar_client_secret" {
  type        = string
  sensitive   = true
  default     = "UNCONFIGURED"
  description = "Google OAuth client secret. Replace after callback domains exist."
}

variable "environment_domains" {
  type = map(string)
  default = {
    prod = "https://www.rive.work"
    test = "https://test.rive.work"
    dev  = "https://dev.rive.work"
  }
}

variable "scheduled_jobs_enabled" {
  type        = bool
  default     = false
  description = "Enable only after all environment DNS records and applications are healthy."
}
