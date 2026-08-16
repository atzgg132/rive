locals {
  name = "rive"
  # dev is the single pre-production environment. Port 3001 stays unassigned so a
  # future environment does not silently inherit the retired test slot.
  environments = toset(["prod", "dev"])
  ports = {
    prod = 3000
    dev  = 3002
  }
  memory_limits = {
    prod = "768m"
    dev  = "384m"
  }
  # Hostnames are declared in caddy/Caddyfile, which is the single source of truth
  # for routing and is shared by the bootstrap and the live-apply script.
}
