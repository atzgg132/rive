locals {
  name         = "rive"
  environments = toset(["prod", "test", "dev"])
  ports = {
    prod = 3000
    test = 3001
    dev  = 3002
  }
  memory_limits = {
    prod = "768m"
    test = "384m"
    dev  = "384m"
  }
  hostnames = {
    prod = "www.${var.domain_name}, ${var.domain_name}"
    test = "test.${var.domain_name}"
    dev  = "dev.${var.domain_name}"
  }
}
