terraform {
  required_version = ">= 1.10.0"

  backend "s3" {
    key          = "platform/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "rive"
      ManagedBy = "terraform"
      Region    = var.aws_region
    }
  }
}

# Route53 health-check metrics exist only in us-east-1; the public-readiness
# alarms and their SNS destination live behind this alias.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project   = "rive"
      ManagedBy = "terraform"
      Region    = var.aws_region
    }
  }
}
