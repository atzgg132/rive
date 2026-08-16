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
# Caddy runs with `admin off`, so there is no admin API to reload through: the
# proxy container has to restart, which refuses connections for a second or two.
# The script validates the new config before restarting, verifies production
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
commands = [
    "set -uo pipefail",
    "STAMP=$(date +%s)",
    "cp /opt/rive/Caddyfile /opt/rive/Caddyfile.bak.$STAMP",
    f"printf '%s' '{encoded}' | base64 -d > /opt/rive/Caddyfile",
    "if ! docker exec rive-proxy caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile; then "
    "echo VALIDATE_FAILED_RESTORING; cp /opt/rive/Caddyfile.bak.$STAMP /opt/rive/Caddyfile; exit 1; fi",
    "echo VALIDATE_OK",
    "docker restart rive-proxy",
    "sleep 8",
    "if ! curl -sf -o /dev/null http://127.0.0.1:3000/api/ready; then "
    "echo PROD_UNHEALTHY_RESTORING; cp /opt/rive/Caddyfile.bak.$STAMP /opt/rive/Caddyfile; "
    "docker restart rive-proxy; exit 1; fi",
    "echo PROD_HEALTHY",
    "curl -s -o /dev/null -w 'prod=%{http_code} ' http://127.0.0.1:3000/api/ready",
    "curl -s -o /dev/null -w 'dev=%{http_code}\\n' http://127.0.0.1:3002/api/ready",
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
