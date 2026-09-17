import assert from "node:assert/strict";
import test from "node:test";

import {
  getRequestId,
  logger,
  logMetric,
  requestLogContext,
} from "../../src/utils/logger.ts";

/** Captures write calls on a stream, restoring it even when assertions throw. */
function capture(stream) {
  const lines = [];
  const original = stream.write;
  stream.write = (chunk) => {
    lines.push(String(chunk));
    return true;
  };
  return {
    lines,
    records: () => lines.map((line) => JSON.parse(line)),
    restore: () => {
      stream.write = original;
    },
  };
}

function withEnv(patch, run) {
  const saved = {};
  for (const key of Object.keys(patch)) {
    saved[key] = process.env[key];
    if (patch[key] === undefined) delete process.env[key];
    else process.env[key] = patch[key];
  }
  try {
    return run();
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test("logger emits one JSON object per line with the operational envelope", () => {
  const cap = capture(process.stdout);
  try {
    withEnv({ APP_ENV: "test-env", DEPLOYMENT_VERSION: "deploy-123" }, () => {
      logger.info("test_event", { userId: "user-1", count: 2 });
    });
  } finally {
    cap.restore();
  }
  assert.equal(cap.lines.length, 1);
  const record = cap.records()[0];
  assert.equal(record.level, "info");
  assert.equal(record.event, "test_event");
  assert.equal(record.environment, "test-env");
  assert.equal(record.deployment, "deploy-123");
  assert.equal(record.userId, "user-1");
  assert.equal(record.count, 2);
  assert.ok(!Number.isNaN(Date.parse(record.timestamp)), "timestamp must be an ISO date");
});

test("environment and deployment fall back to local", () => {
  const cap = capture(process.stdout);
  try {
    withEnv({ APP_ENV: undefined, DEPLOYMENT_VERSION: undefined }, () => {
      logger.debug("defaults");
    });
  } finally {
    cap.restore();
  }
  const record = cap.records()[0];
  assert.equal(record.environment, "local");
  assert.equal(record.deployment, "local");
});

test("warn and error go to stderr, debug and info to stdout", () => {
  const out = capture(process.stdout);
  const err = capture(process.stderr);
  try {
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
  } finally {
    out.restore();
    err.restore();
  }
  assert.deepEqual(out.records().map((r) => r.event), ["d", "i"]);
  assert.deepEqual(err.records().map((r) => r.event), ["w", "e"]);
});

test("sensitive keys are redacted recursively, including to/from/email", () => {
  const cap = capture(process.stdout);
  try {
    logger.info("redaction", {
      password: "hunter2",
      nested: { authorization: "Bearer abc.def.ghi", adminTotpSecret: "JBSWY3DPEHPK3PXP", count: 3 },
      headers: { cookie: "session=zzz", "x-safe": "kept" },
      list: [{ token: "t".repeat(40) }],
      smtpPass: "mail-password",
      to: "client@example.com",
      userId: "user-9",
      jobId: "job-7",
    });
  } finally {
    cap.restore();
  }
  const line = cap.lines[0];
  for (const leaked of ["hunter2", "abc.def.ghi", "JBSWY3DPEHPK3PXP", "session=zzz", "t".repeat(40), "mail-password", "client@example.com"]) {
    assert.ok(!line.includes(leaked), `log line leaked ${leaked}`);
  }
  const record = cap.records()[0];
  assert.equal(record.nested.count, 3);
  assert.equal(record.headers["x-safe"], "kept");
  // Entity identifiers stay — they are what make the line useful.
  assert.equal(record.userId, "user-9");
  assert.equal(record.jobId, "job-7");
});

test("email-looking strings, bearer credentials, and JWTs are scrubbed inside string values", () => {
  const cap = capture(process.stderr);
  try {
    logger.warn("delivery", {
      message: "SMTP failed for <victim@example.com> after AUTH Bearer supersecretvalue",
      note: "saw token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.dbsjflsjdflkj",
    });
  } finally {
    cap.restore();
  }
  const line = cap.lines[0];
  for (const leaked of ["victim@example.com", "supersecretvalue", "eyJhbGciOiJIUzI1NiJ9"]) {
    assert.ok(!line.includes(leaked), `log line leaked ${leaked}`);
  }
  const record = cap.records()[0];
  assert.ok(record.message.includes("[redacted-email]"));
  assert.ok(record.message.includes("Bearer [redacted]"));
});

test("URLs lose query strings, fragments, and credentials; sensitive paths collapse", () => {
  const cap = capture(process.stdout);
  try {
    logger.info("link", {
      signing: "https://rive.work/sign/secrettoken123?x=1#frag",
      relayNote: "smtp relay smtps://user:secretpass@mail.example.com:465 bounced",
      path: "/api/public/contracts/review/rawtoken456",
      plain: "/api/admin/login",
    });
  } finally {
    cap.restore();
  }
  const record = cap.records()[0];
  assert.equal(record.signing, "https://rive.work/sign/[token]");
  assert.equal(record.relayNote, "smtp relay [redacted-url] bounced");
  assert.equal(record.path, "/api/public/contracts/review/[token]");
  assert.equal(record.plain, "/api/admin/login");
  for (const leaked of ["secrettoken123", "secretpass", "rawtoken456", "x=1", "frag"]) {
    assert.ok(!cap.lines[0].includes(leaked), `log line leaked ${leaked}`);
  }
});

test("Error values serialize to name, message, and code only", () => {
  const cap = capture(process.stderr);
  try {
    const failure = new Error("connect to client@example.com refused");
    failure.code = "ECONNREFUSED";
    failure.response = { secrets: "provider-payload" };
    logger.error("failed", { error: failure });
  } finally {
    cap.restore();
  }
  const record = cap.records()[0];
  assert.equal(record.error.name, "Error");
  assert.equal(record.error.code, "ECONNREFUSED");
  assert.ok(!record.error.message.includes("client@example.com"));
  assert.ok(!("response" in record.error), "provider payloads must not be serialized");
  assert.ok(!("secrets" in record.error));
});

test("long strings and deep objects stay bounded", () => {
  const cap = capture(process.stdout);
  try {
    const deep = { a: { b: { c: { d: { e: { f: { g: "too deep" } } } } } } };
    logger.info("bounds", { big: "x".repeat(10_000), deep });
  } finally {
    cap.restore();
  }
  const record = cap.records()[0];
  assert.ok(record.big.length <= 2100, "long strings must be truncated");
  assert.ok(record.big.endsWith("[truncated]"));
  assert.equal(record.deep.a.b.c.d.e, "[truncated]");
});

test("reserved record fields cannot be overwritten by context", () => {
  const cap = capture(process.stdout);
  try {
    logger.info("real_event", { event: "spoofed", level: "error", environment: "fake" });
  } finally {
    cap.restore();
  }
  const record = cap.records()[0];
  assert.equal(record.event, "real_event");
  assert.equal(record.level, "info");
  assert.notEqual(record.environment, "fake");
});

test("getRequestId prefers a safe inbound x-rive-request-id", () => {
  const request = new Request("https://app.test/api/ping", {
    headers: { "x-rive-request-id": "req_1234.abcd-ef" },
  });
  assert.equal(getRequestId(request), "req_1234.abcd-ef");
});

test("getRequestId falls back to x-request-id, then to a fresh uuid", () => {
  const fallback = new Request("https://app.test/api/ping", {
    headers: { "x-request-id": "abcdefgh" },
  });
  assert.equal(getRequestId(fallback), "abcdefgh");

  // An unsafe preferred header is skipped, not reflected, and the safe
  // fallback is still honoured.
  const unsafePreferred = new Request("https://app.test/api/ping", {
    headers: { "x-rive-request-id": "bad id with spaces", "x-request-id": "fallback-1" },
  });
  assert.equal(getRequestId(unsafePreferred), "fallback-1");
});

test("getRequestId never reflects unsafe inbound ids", () => {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  for (const bad of [
    "short",
    "a".repeat(200),
    "../../etc/passwd",
    "id;DROP TABLE",
    "id with space inside",
    "[::1]",
  ]) {
    const request = new Request("https://app.test/api/ping", { headers: { "x-rive-request-id": bad } });
    const id = getRequestId(request);
    assert.notEqual(id, bad, bad);
    assert.match(id, uuidPattern, `expected a generated uuid for ${JSON.stringify(bad)}`);
  }
});

test("requestLogContext carries requestId, method, and a sanitized path only", () => {
  const request = new Request("https://rive.work/api/public/contracts/review/rawtoken789?token=abc&x=1", {
    method: "POST",
    headers: { "x-rive-request-id": "reqid-0001" },
  });
  const context = requestLogContext(request);
  assert.deepEqual(Object.keys(context).sort(), ["method", "path", "requestId"]);
  assert.equal(context.requestId, "reqid-0001");
  assert.equal(context.method, "POST");
  assert.equal(context.path, "/api/public/contracts/review/[token]");
  assert.ok(!JSON.stringify(context).includes("rawtoken789"));
  assert.ok(!JSON.stringify(context).includes("token=abc"));
});

test("logMetric emits top-level metricName and metricValue for metric filters", () => {
  const cap = capture(process.stdout);
  try {
    logMetric("email_outbox_oldest_queued_seconds", 42, { requestId: "reqid-42", claimed: 3 });
  } finally {
    cap.restore();
  }
  const record = cap.records()[0];
  assert.equal(record.metricName, "email_outbox_oldest_queued_seconds");
  assert.equal(record.metricValue, 42);
  assert.equal(record.level, "info");
  assert.equal(record.requestId, "reqid-42");
  assert.equal(record.claimed, 3);
});
