#!/usr/bin/env bash
#
# Deploy an immutable release to the Rive host without dropping traffic.
#
# Runs ON the host (uploaded by scripts/deploy-to-host.sh through SSM, or
# installed by the instance bootstrap). Flow:
#   1. refresh /opt/rive/env/<env>.env from SSM Parameter Store
#   2. pull the immutable app and migration images
#   3. run the migration image
#   4. start a candidate app container on the alternate port
#   5. wait for /api/ready on the candidate
#   6. repoint Caddy (via /opt/rive/proxy-upstreams.env) at the candidate
#   7. verify public readiness through the real domain
#   8. only then retire the old container as <name>-previous (kept stopped)
#
# If candidate readiness or public verification fails, the previous Caddy
# upstream is restored and the candidate removed; the old container keeps
# serving throughout. Images are never pruned with -af during a deploy.
#
# Usage: deploy-runtime.sh <prod|dev> <image-tag> [region] [repository-url]

set -euo pipefail

ENVIRONMENT="${1:?usage: deploy-runtime.sh <prod|dev> <image-tag> [region] [repository-url]}"
IMAGE="${2:?usage: deploy-runtime.sh <prod|dev> <image-tag> [region] [repository-url]}"
REGION="${3:-${AWS_REGION:-ap-south-1}}"
REPOSITORY_URL="${4:-${ECR_REPOSITORY_URL:-}}"

case "$ENVIRONMENT" in
  prod) ACTIVE_PORT=3000 CANDIDATE_PORT=3100 PUBLIC_URL="${RIVE_PUBLIC_URL:-https://www.rive.work}" ;;
  dev)  ACTIVE_PORT=3002 CANDIDATE_PORT=3102 PUBLIC_URL="${RIVE_PUBLIC_URL:-https://dev.rive.work}" ;;
  *)    echo "Unknown environment: $ENVIRONMENT" >&2; exit 2 ;;
esac
MEMORY="${RIVE_APP_MEMORY:-$([ "$ENVIRONMENT" = prod ] && echo 768m || echo 384m)}"
CONTAINER="rive-$ENVIRONMENT"
CANDIDATE="$CONTAINER-candidate"
UPSTREAMS_FILE=/opt/rive/proxy-upstreams.env
UPSTREAMS_BAK=/opt/rive/proxy-upstreams.env.bak
ENV_FILE="/opt/rive/env/$ENVIRONMENT.env"
CADDY_IMAGE=caddy:2.10-alpine

[ -n "$REPOSITORY_URL" ] || REPOSITORY_URL="$(aws ecr describe-repositories \
  --region "$REGION" --repository-names rive/app \
  --query 'repositories[0].repositoryUri' --output text)"

# Upstream env file may not exist on a host that predates it; the Caddyfile
# defaults match, so seed it with the historical ports.
if [ ! -f "$UPSTREAMS_FILE" ]; then
  printf 'RIVE_PROD_UPSTREAM=127.0.0.1:3000\nRIVE_DEV_UPSTREAM=127.0.0.1:3002\n' >"$UPSTREAMS_FILE"
fi
# shellcheck disable=SC1090
. "$UPSTREAMS_FILE"
RIVE_PROD_UPSTREAM="${RIVE_PROD_UPSTREAM:-127.0.0.1:3000}"
RIVE_DEV_UPSTREAM="${RIVE_DEV_UPSTREAM:-127.0.0.1:3002}"

# Flip between the two ports for this environment so the candidate never fights
# the serving container for its port.
if [ "$ENVIRONMENT" = prod ]; then
  CURRENT_PORT="${RIVE_PROD_UPSTREAM##*:}"
else
  CURRENT_PORT="${RIVE_DEV_UPSTREAM##*:}"
fi
if [ "$CURRENT_PORT" = "$ACTIVE_PORT" ]; then
  NEXT_PORT="$CANDIDATE_PORT"
else
  NEXT_PORT="$ACTIVE_PORT"
fi

write_upstreams() {
  if [ "$ENVIRONMENT" = prod ]; then
    printf 'RIVE_PROD_UPSTREAM=127.0.0.1:%s\nRIVE_DEV_UPSTREAM=%s\n' "$1" "$RIVE_DEV_UPSTREAM" >"$UPSTREAMS_FILE"
  else
    printf 'RIVE_PROD_UPSTREAM=%s\nRIVE_DEV_UPSTREAM=127.0.0.1:%s\n' "$RIVE_PROD_UPSTREAM" "$1" >"$UPSTREAMS_FILE"
  fi
}

recreate_proxy() {
  docker run --rm \
    --env-file "$UPSTREAMS_FILE" \
    -v /opt/rive/Caddyfile:/etc/caddy/Caddyfile:ro \
    "$CADDY_IMAGE" \
    validate --adapter caddyfile --config /etc/caddy/Caddyfile
  docker rm -f rive-proxy >/dev/null 2>&1 || true
  docker run -d \
    --name rive-proxy \
    --restart unless-stopped \
    --network host \
    --env-file "$UPSTREAMS_FILE" \
    -v /opt/rive/Caddyfile:/etc/caddy/Caddyfile:ro \
    -v /opt/rive/caddy/data:/data \
    -v /opt/rive/caddy/config:/config \
    --log-driver awslogs \
    --log-opt awslogs-region="$REGION" \
    --log-opt awslogs-group=/rive/proxy \
    --log-opt awslogs-stream=rive-proxy \
    --log-opt awslogs-create-group=true \
    "$CADDY_IMAGE" >/dev/null
}

# 1. Refresh runtime parameters.
TMP_FILE="$ENV_FILE.tmp"
umask 077
: >"$TMP_FILE"
aws ssm get-parameters-by-path \
  --region "$REGION" \
  --path "/rive/$ENVIRONMENT/" \
  --recursive \
  --with-decryption \
  --output json |
  jq -r '.Parameters[] | select(.Name | endswith("/DB_PASSWORD") | not) | [(.Name | split("/") | last), .Value] | @tsv' |
  while IFS=$'\t' read -r key value; do
    printf '%s=%s\n' "$key" "$value" >>"$TMP_FILE"
  done
printf 'DEPLOYMENT_VERSION=%s\n' "$IMAGE" >>"$TMP_FILE"
mv "$TMP_FILE" "$ENV_FILE"

# 2. Pull the immutable images.
aws ecr get-login-password --region "$REGION" |
  docker login --username AWS --password-stdin "${REPOSITORY_URL%%/*}" >/dev/null
docker pull "$REPOSITORY_URL:$IMAGE"
docker pull "$REPOSITORY_URL:$IMAGE-migrate"

# 3. Run migrations.
docker rm -f "rive-$ENVIRONMENT-migrate" >/dev/null 2>&1 || true
docker run --rm \
  --name "rive-$ENVIRONMENT-migrate" \
  --network host \
  --env-file "$ENV_FILE" \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=2 \
  "$REPOSITORY_URL:$IMAGE-migrate"

# 4. Candidate container on the alternate port.
docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true
docker run -d \
  --name "$CANDIDATE" \
  --restart unless-stopped \
  --memory "$MEMORY" \
  --stop-timeout 30 \
  -p "127.0.0.1:$NEXT_PORT:3000" \
  --env-file "$ENV_FILE" \
  --log-driver awslogs \
  --log-opt awslogs-region="$REGION" \
  --log-opt awslogs-group="/rive/app/$ENVIRONMENT" \
  --log-opt awslogs-stream="$ENVIRONMENT" \
  --log-opt awslogs-create-group=true \
  "$REPOSITORY_URL:$IMAGE" >/dev/null

# 5. Candidate readiness.
ready=""
for _ in $(seq 1 45); do
  if curl --fail --silent --max-time 5 "http://127.0.0.1:$NEXT_PORT/api/ready" >/dev/null; then
    ready=1
    break
  fi
  sleep 2
done
if [ -z "$ready" ]; then
  echo "Candidate never became ready; upstreams untouched." >&2
  docker logs --tail 100 "$CANDIDATE" || true
  docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true
  exit 1
fi

# 6. Repoint Caddy at the candidate; restore on any failure.
cp "$UPSTREAMS_FILE" "$UPSTREAMS_BAK"
write_upstreams "$NEXT_PORT"
if ! recreate_proxy; then
  echo "Proxy recreation failed; restoring previous upstream." >&2
  cp "$UPSTREAMS_BAK" "$UPSTREAMS_FILE"
  recreate_proxy || true
  docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true
  exit 1
fi

# 7. Public readiness through the real domain.
ready=""
for _ in $(seq 1 30); do
  if curl --fail --silent --max-time 8 "$PUBLIC_URL/api/ready" >/dev/null; then
    ready=1
    break
  fi
  sleep 2
done
if [ -z "$ready" ]; then
  echo "Public readiness check failed; restoring previous upstream." >&2
  cp "$UPSTREAMS_BAK" "$UPSTREAMS_FILE"
  recreate_proxy || true
  docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true
  exit 1
fi

# 8. Retire the previous release; keep it stopped for instant rollback.
docker rm -f "$CONTAINER-previous" >/dev/null 2>&1 || true
if docker inspect "$CONTAINER" >/dev/null 2>&1; then
  docker stop --time 30 "$CONTAINER" >/dev/null
  docker rename "$CONTAINER" "$CONTAINER-previous"
fi
docker rename "$CANDIDATE" "$CONTAINER"
docker image prune -f >/dev/null 2>&1 || true
echo "$ENVIRONMENT deployed: $REPOSITORY_URL:$IMAGE on port $NEXT_PORT"
