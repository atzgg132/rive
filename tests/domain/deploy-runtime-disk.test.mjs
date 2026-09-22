import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Structural guard for the host deploy script: pre-pull disk free must stay
// in front of docker pull, and volume/system prunes must never appear.
// Mirrors the pattern in migration-rollback-safety.test.mjs — no database.

const scriptPath = fileURLToPath(new URL("../../scripts/deploy-runtime.sh", import.meta.url));
const source = readFileSync(scriptPath, "utf8");
const pullMarker = "# 2. Pull the immutable images.";
const cleanupMarker = "# 1b. Free disk before pull.";
const pullAt = source.indexOf(pullMarker);
const cleanupAt = source.indexOf(cleanupMarker);
const pullCmdAt = source.indexOf('docker pull "$REPOSITORY_URL:$IMAGE"');

test("deploy-runtime.sh frees disk before pulling images", () => {
  assert.ok(pullAt !== -1, "pull step marker must exist");
  assert.ok(pullCmdAt !== -1, "docker pull of the app image must exist");
  const prePull = source.slice(0, pullAt);

  assert.match(prePull, /df -h/, "must log df -h before pull");
  assert.match(prePull, /docker system df/, "must log docker system df before pull");
  assert.match(
    prePull,
    /rm -rf \/tmp\/aws-backup-2026-09-23 \/tmp\/aws-backup-2026-09-23\.tar\.gz/,
    "must remove the overnight backup leftovers before pull",
  );
  assert.match(prePull, /docker container prune -f/, "must prune stopped containers before pull");
  assert.match(prePull, /docker image prune -af/, "must prune unused images with -af before pull");
  assert.match(prePull, /docker builder prune -af/, "must prune builder cache before pull when available");
  assert.match(prePull, /df -PB1 \//, "must measure root free space in bytes before pull");
  assert.match(prePull, /1610612736/, "must require ~1.5GiB free before pull");
  assert.ok(prePull.includes("Refusing to pull images"), "must fail the deploy early if disk is still tight");

  assert.ok(
    prePull.indexOf("docker image prune -af") < pullCmdAt,
    "unused-image prune must run before docker pull",
  );
});

test("deploy-runtime.sh never prunes volumes or force-removes the serving container before pull", () => {
  assert.doesNotMatch(source, /docker volume prune/);
  assert.doesNotMatch(source, /docker system prune/);
  assert.ok(cleanupAt !== -1 && pullAt > cleanupAt, "disk-free step must sit immediately before pull");
  const cleanup = source.slice(cleanupAt, pullAt);
  assert.doesNotMatch(cleanup, /docker rm -f "\$CONTAINER"/);
  assert.doesNotMatch(cleanup, /docker rm -f rive-proxy/);
  assert.doesNotMatch(cleanup, /docker rm -f "\$CANDIDATE"/);
});
