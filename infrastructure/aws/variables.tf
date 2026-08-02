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

variable "zoho_smtp_user" {
  type        = string
  default     = "hello@rive.work"
  description = "Zoho Mail account used for production transactional email."
}

variable "zoho_smtp_password" {
  type        = string
  sensitive   = true
  default     = "UNCONFIGURED"
  description = "Zoho app password for production SMTP. Supply through TF_VAR_zoho_smtp_password; never commit it."
}

variable "email_provider" {
  type        = string
  default     = "zoho"
  description = "Production transactional provider. Keep zoho until SES production access is approved, then set ses."

  validation {
    condition     = contains(["zoho", "ses"], var.email_provider)
    error_message = "email_provider must be either zoho or ses."
  }
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

variable "contract_billing_jobs_enabled" {
  type        = bool
  default     = true
  description = "Run the contract maintenance worker so milestone and date-based invoice triggers are processed."
}
