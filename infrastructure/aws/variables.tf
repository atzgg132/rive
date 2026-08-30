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

variable "admin_username" {
  type        = string
  default     = "Admin1"
  description = "Temporary admin portal username. Change through SSM after bootstrap."
}

variable "admin_password_hash" {
  type        = string
  sensitive   = true
  default     = "scrypt:rive-admin-bootstrap-salt:a081a3dcd120cf64dfed4441573bb3fc3141b8ca921be594ad2d41bc3dd4e863dd7137f49c5afeb8f7de098b860c72c61f5610693ba5d6f24b0a9d2d3c7c1bf8"
  description = "Temporary scrypt hash for the bootstrap admin password. Change through SSM after bootstrap."
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

variable "zoho_books_client_id" {
  type        = string
  sensitive   = true
  default     = "UNCONFIGURED"
  description = "Zoho Books server-based OAuth client ID."
}

variable "zoho_books_client_secret" {
  type        = string
  sensitive   = true
  default     = "UNCONFIGURED"
  description = "Zoho Books server-based OAuth client secret."
}

variable "smtp_host" {
  type        = string
  default     = "smtp.gmail.com"
  description = "SMTP host used for production transactional email. Google Workspace uses smtp.gmail.com."
}

variable "smtp_port" {
  type        = number
  default     = 587
  description = "SMTP port used for production transactional email."

  validation {
    condition     = var.smtp_port > 0 && var.smtp_port <= 65535
    error_message = "smtp_port must be between 1 and 65535."
  }
}

variable "smtp_secure" {
  type        = bool
  default     = false
  description = "Use implicit TLS for SMTP. Google Workspace port 587 should use STARTTLS (false)."
}

variable "smtp_user" {
  type        = string
  default     = "hello@rive.work"
  description = "Google Workspace account used for production transactional email."
}

variable "smtp_password" {
  type        = string
  sensitive   = true
  default     = "UNCONFIGURED"
  description = "Google Workspace app password for production SMTP. Supply through TF_VAR_smtp_password; never commit it."
}

variable "email_provider" {
  type        = string
  default     = "smtp"
  description = "Production transactional provider. Use smtp for Google Workspace or ses after SES production access is approved."

  validation {
    condition     = contains(["smtp", "zoho", "ses"], var.email_provider)
    error_message = "email_provider must be smtp, zoho, or ses."
  }
}

variable "environment_domains" {
  type = map(string)
  default = {
    prod = "https://www.rive.work"
    dev  = "https://dev.rive.work"
  }
}

variable "scheduled_jobs_enabled" {
  type        = bool
  default     = true
  description = "Keep the established EventBridge schedules running. Set false only as an explicit incident-response override."
}

variable "contract_billing_jobs_enabled" {
  type        = bool
  default     = true
  description = "Run the contract maintenance worker so milestone and date-based invoice triggers are processed."
}
