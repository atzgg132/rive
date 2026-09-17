#!/usr/bin/env bash
#
# Push infrastructure/aws/caddy/Caddyfile to the running host and reload Caddy.
#
# Routing is generated inside the instance bootstrap, and aws_instance.app
# ignores user_data changes so that Terraform never replaces a live production
# server. The consequence is that editing the Caddyfile — or the bootstrap
# template — changes nothing that is currently serving traffic. This script is
# how a routing change actually reaches the host.
#
# Caddy runs with `admin off`, so there is no admin API to reload through. The
# Caddyfile resolves upstream ports from environment variables at adapt time,
# and `docker restart` would reuse the container's original environment — so
# the proxy is recreated against /opt/rive/proxy-upstreams.env instead, which
# refuses connections for a second or two. The script validates the new config
# (with the current upstreams loaded) before recreating, verifies production
# answers afterwards, and restores the previous file if either check fails.
#
# Usage:  scripts/apply-caddy-config.sh [instance-id]

set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
INSTANCE_ID="${1:-${RIVE_INSTANCE_ID:-i-0ab917bc04f0fb304}}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CADDYFILE="$REPO_ROOT/infrastructure/aws/caddy/Caddyfile"

[ -f "$CADDYFILE" ] || { echo "Missing $CADDYFILE" >&2; exit 1; }

echo "Applying $CADDYFILE to $INSTANCE_ID in $REGION"

# Ship the file as base64 so no quoting in the config can break the shell that
# writes it out on the far side.
ENCODED="$(base64 -w0 <"$CADDYFILE" 2>/dev/null || base64 <"$CADDYFILE" | tr -d '\n')"

PAYLOAD="$(REGION="$REGION" ENCODED="$ENCODED" python3 - <<'PY'
import json, os
encoded = os.environ["ENCODED"]
region = os.environ["REGION"]
commands = [
    "set -uo pipefail",
    "STAMP=$(date +%s)",
    "cp /opt/rive/Caddyfile /opt/rive/Caddyfile.bak.$STAMP",
    f"printf '%s' '{encoded}' | base64 -d > /opt/rive/Caddyfile",
    # Upstream env file may not exist on a host that predates it; the Caddyfile
    # defaults cover that case.
    "[ -f /opt/rive/proxy-upstreams.env ] || "
    "printf 'RIVE_PROD_UPSTREAM=127.0.0.1:3000\\nRIVE_DEV_UPSTREAM=127.0.0.1:3002\\n' "
    "> /opt/rive/proxy-upstreams.env",
    "if ! docker run --rm --env-file /opt/rive/proxy-upstreams.env "
    "-v /opt/rive/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2.10-alpine "
    "validate --adapter caddyfile --config /etc/caddy/Caddyfile; then "
    "echo VALIDATE_FAILED_RESTORING; cp /opt/rive/Caddyfile.bak.$STAMP /opt/rive/Caddyfile; exit 1; fi",
    "echo VALIDATE_OK",
    "docker rm -f rive-proxy",
    "docker run -d --name rive-proxy --restart unless-stopped --network host "
    "--env-file /opt/rive/proxy-upstreams.env "
    "-v /opt/rive/Caddyfile:/etc/caddy/Caddyfile:ro "
    "-v /opt/rive/caddy/data:/data -v /opt/rive/caddy/config:/config "
    "--log-driver awslogs "
    f"--log-opt awslogs-region={region} "
    "--log-opt awslogs-group=/rive/proxy --log-opt awslogs-stream=rive-proxy "
    "--log-opt awslogs-create-group=true caddy:2.10-alpine",
    "sleep 8",
    # The live upstream port may be the alternate after a blue/green deploy, so
    # verify through whatever the env file currently points Caddy at.
    "PROD_PORT=$(sed -n 's/^RIVE_PROD_UPSTREAM=.*://p' /opt/rive/proxy-upstreams.env)",
    "PROD_PORT=${PROD_PORT:-3000}",
    "if ! curl -sf --max-time 5 -o /dev/null http://127.0.0.1:$PROD_PORT/api/ready; then "
    "echo PROD_UNHEALTHY_RESTORING; cp /opt/rive/Caddyfile.bak.$STAMP /opt/rive/Caddyfile; "
    "docker rm -f rive-proxy; "
    "docker run -d --name rive-proxy --restart unless-stopped --network host "
    "--env-file /opt/rive/proxy-upstreams.env "
    "-v /opt/rive/Caddyfile:/etc/caddy/Caddyfile:ro "
    "-v /opt/rive/caddy/data:/data -v /opt/rive/caddy/config:/config "
    "--log-driver awslogs "
    f"--log-opt awslogs-region={region} "
    "--log-opt awslogs-group=/rive/proxy --log-opt awslogs-stream=rive-proxy "
    "--log-opt awslogs-create-group=true caddy:2.10-alpine; exit 1; fi",
    "echo PROD_HEALTHY",
    "curl -s --max-time 5 -o /dev/null -w 'prod=%{http_code} ' http://127.0.0.1:$PROD_PORT/api/ready",
    "DEV_PORT=$(sed -n 's/^RIVE_DEV_UPSTREAM=.*://p' /opt/rive/proxy-upstreams.env)",
    "curl -s --max-time 5 -o /dev/null -w 'dev=%{http_code}\\n' "
    "http://127.0.0.1:${DEV_PORT:-3002}/api/ready",
]
print(json.dumps({"commands": commands}))
PY
)"

COMMAND_ID="$(aws ssm send-command \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters "$PAYLOAD" \
  --query Command.CommandId \
  --output text)"

echo "SSM command $COMMAND_ID dispatched; waiting…"
set +e
aws ssm wait command-executed --region "$REGION" --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID"
WAIT_STATUS=$?
set -e

aws ssm get-command-invocation \
  --region "$REGION" \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --query '{Status:Status,Output:StandardOutputContent,Error:StandardErrorContent}' \
  --output text

if [ "$WAIT_STATUS" -ne 0 ]; then
  echo "Caddy config was NOT applied; the previous file has been restored." >&2
  exit "$WAIT_STATUS"
fi

echo "Applied. Verify: curl -sI https://rive.work | head -1"
