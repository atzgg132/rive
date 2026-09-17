#!/usr/bin/env bash
#
# Ship the deploy script and canonical Caddyfile to the Rive host over SSM and
# run the deploy there. There is no SSH on the host; the only way in is
# AWS-RunShellScript, and SSM command strings have a size ceiling, so the two
# files travel as base64 chunks appended to temp files and decoded in place.
#
# Usage: scripts/deploy-to-host.sh <instance-id> <prod|dev> <image-tag> [region] [repository-url]

set -euo pipefail

INSTANCE_ID="${1:?usage: deploy-to-host.sh <instance-id> <environment> <image-tag> [region] [repository-url]}"
ENVIRONMENT="${2:?environment required}"
IMAGE_TAG="${3:?image tag required}"
REGION="${4:-${AWS_REGION:-ap-south-1}}"
REPOSITORY_URL="${5:-${ECR_REPOSITORY_URL:-}}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_SCRIPT="$REPO_ROOT/scripts/deploy-runtime.sh"
CADDYFILE="$REPO_ROOT/infrastructure/aws/caddy/Caddyfile"

[ -f "$DEPLOY_SCRIPT" ] || { echo "Missing $DEPLOY_SCRIPT" >&2; exit 1; }
[ -f "$CADDYFILE" ] || { echo "Missing $CADDYFILE" >&2; exit 1; }

echo "Deploying $IMAGE_TAG to $ENVIRONMENT on $INSTANCE_ID ($REGION)"

PAYLOAD="$(REGION="$REGION" ENVIRONMENT="$ENVIRONMENT" IMAGE_TAG="$IMAGE_TAG" \
  REPOSITORY_URL="$REPOSITORY_URL" \
  DEPLOY_SCRIPT="$DEPLOY_SCRIPT" CADDYFILE="$CADDYFILE" \
  python3 - <<'PY'
import base64, json, os

commands = ["set -euo pipefail"]

def upload(path, dest):
    encoded = base64.b64encode(open(path, "rb").read()).decode()
    tmp = f"/tmp/{os.path.basename(dest)}.b64"
    commands.append(f": > {tmp}")
    for i in range(0, len(encoded), 3000):
        commands.append(f"printf '%s' '{encoded[i:i+3000]}' >> {tmp}")
    commands.append(f"base64 -d {tmp} > {dest} && rm {tmp}")

upload(os.environ["DEPLOY_SCRIPT"], "/opt/rive/deploy-runtime.sh")
upload(os.environ["CADDYFILE"], "/opt/rive/Caddyfile")
commands.append("chmod 750 /opt/rive/deploy-runtime.sh")
commands.append(
    "/opt/rive/deploy-runtime.sh "
    + os.environ["ENVIRONMENT"] + " "
    + os.environ["IMAGE_TAG"] + " "
    + os.environ["REGION"] + " "
    + os.environ["REPOSITORY_URL"]
)
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

exit "$WAIT_STATUS"
