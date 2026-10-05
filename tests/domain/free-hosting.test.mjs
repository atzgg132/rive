import test from "node:test";
import assert from "node:assert/strict";
import { objectStorageClientConfig } from "../../src/utils/objectStorage.ts";
import { enqueueMigrationWork } from "../../src/utils/migration/queue.ts";
import { markMigrationObjectVerified } from "../../src/utils/migration/uploads.ts";
import { scheduledPaths } from "../../netlify/src/jobs-background.ts";
import { handler as handleJobs } from "../../netlify/src/jobs-background.ts";
import { handler as handleImport } from "../../netlify/src/migration-worker-background.ts";
import { getRequestIpFromHeaders } from "../../src/utils/rateLimit.ts";

async function withEnvironment(values, run) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("R2 cannot silently fall back to AWS or send credentials to another origin", async () => {
  await withEnvironment({ ASSET_STORAGE_PROVIDER: "r2", AWS_REGION: "auto", AWS_ACCESS_KEY_ID: "test-id", AWS_SECRET_ACCESS_KEY: "test-secret", S3_ENDPOINT: undefined }, async () => {
    assert.throws(objectStorageClientConfig, /endpoint and credentials/);
    process.env.S3_ENDPOINT = "https://example.com";
    assert.throws(objectStorageClientConfig, /Cloudflare HTTPS/);
    process.env.S3_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    const config = objectStorageClientConfig();
    assert.equal(config.region, "auto");
    assert.equal(config.endpoint, process.env.S3_ENDPOINT);
    assert.equal(config.forcePathStyle, true);
    assert.equal(config.credentials.accessKeyId, "test-id");
  });
});

test("R2 verification does not call unsupported object-tagging APIs", async () => {
  await withEnvironment({ ASSET_STORAGE_PROVIDER: "r2", AWS_REGION: "auto", ASSET_BUCKET: "test-bucket" }, async () => {
    await markMigrationObjectVerified("migration/test-object");
  });
});

test("Netlify import dispatch requires acceptance and retains the message contract", async () => {
  await withEnvironment({ MIGRATION_QUEUE_PROVIDER: "netlify", NETLIFY_SITE_URL: "https://rive-test.netlify.app", CRON_SECRET: "test-cron-secret", APP_ENV: "prod" }, async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url, options) => {
        assert.equal(url.href, "https://rive-test.netlify.app/.netlify/functions/migration-worker-background");
        assert.equal(options.headers.Authorization, "Bearer test-cron-secret");
        assert.deepEqual(JSON.parse(options.body), { version: 1, environment: "prod", migrationId: "test-import", operation: "analyze", inputRevision: 1 });
        return new Response(null, { status: 202 });
      };
      assert.equal(await enqueueMigrationWork({ migrationId: "test-import", operation: "analyze", inputRevision: 1 }), true);
      globalThis.fetch = async () => new Response(null, { status: 503 });
      await assert.rejects(enqueueMigrationWork({ migrationId: "test-import", operation: "analyze", inputRevision: 1 }), /did not accept/);
      delete process.env.NETLIFY_SITE_URL;
      await assert.rejects(enqueueMigrationWork({ migrationId: "test-import", operation: "analyze", inputRevision: 1 }), /not configured/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("replacement schedules retain every enabled production job", () => {
  assert.deepEqual(scheduledPaths(new Date("2026-10-06T12:01:00Z")), ["/api/cron/email-outbox"]);
  assert.deepEqual(scheduledPaths(new Date("2026-10-06T12:05:00Z")), ["/api/cron/email-outbox", "/api/calendar/sync-outbox"]);
  assert.deepEqual(scheduledPaths(new Date("2026-10-06T12:00:00Z")), [
    "/api/cron/email-outbox", "/api/calendar/sync-outbox", "/api/contracts/maintenance", "/api/cron/funnel-quality",
    "/api/cron/portfolio-assets", "/api/cron/weekly-summary", "/api/calendar/maintenance",
  ]);
});

test("background workers reject unauthenticated requests before accessing data", async () => {
  await withEnvironment({ CRON_SECRET: "test-secret", NETLIFY_SCHEDULES_ENABLED: "true" }, async () => {
    for (const handler of [handleJobs, handleImport]) {
      assert.equal((await handler({ httpMethod: "POST", headers: {}, body: "{}" })).statusCode, 401);
      assert.equal((await handler({ httpMethod: "GET", headers: { authorization: "Bearer test-secret" }, body: null })).statusCode, 401);
    }
    const response = await handleImport({ httpMethod: "POST", headers: { authorization: "Bearer test-secret" }, body: "invalid" });
    assert.equal(response.statusCode, 400);
  });
});

test("Netlify IP rate-limit keys ignore caller-controlled forwarding headers", async () => {
  await withEnvironment({ HOSTING_PROVIDER: "netlify" }, async () => {
    const headers = new Headers({ "x-nf-client-connection-ip": "203.0.113.7", "x-forwarded-for": "192.0.2.8", "x-real-ip": "192.0.2.9" });
    assert.equal(getRequestIpFromHeaders(headers), "203.0.113.7");
    headers.delete("x-nf-client-connection-ip");
    assert.equal(getRequestIpFromHeaders(headers), "unknown");
    headers.set("x-nf-client-connection-ip", "999.0.0.1");
    assert.equal(getRequestIpFromHeaders(headers), "unknown");
  });
});
