import assert from "node:assert/strict";
import test from "node:test";

/**
 * Unit tests for the shared API body/error boundary helper.
 *
 * Run with the module loader so `next/server` resolves to the shim:
 *   node --experimental-strip-types --import ./tests/helpers/module-loader.mjs \
 *        --test tests/domain/api-boundary.test.mjs
 */

const {
  readJsonBody,
  jsonErrorResponse,
  internalErrorResponse,
  API_BODY_DEFAULT_MAX_BYTES,
  API_BODY_LARGE_MAX_BYTES,
} = await import("../../src/utils/apiBoundary.ts");

const REQUEST_ID = "test-request-01";

function post(body, headers = {}) {
  return new Request("http://localhost/api/example", {
    method: "POST",
    headers: { "content-type": "application/json", "x-rive-request-id": REQUEST_ID, ...headers },
    ...(body === undefined ? {} : { body }),
  });
}

test("a well-formed JSON object body parses through", async () => {
  const result = await readJsonBody(post(JSON.stringify({ name: "Acme", n: 1 })));
  assert.equal(result.ok, true);
  assert.deepEqual(result.body, { name: "Acme", n: 1 });
});

test("a declared Content-Length over the cap is refused before reading", async () => {
  // Even a tiny body is rejected when the header announces an oversized payload.
  const result = await readJsonBody(post("{}", { "content-length": String(API_BODY_DEFAULT_MAX_BYTES + 1) }));
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 413);
  const data = await result.response.json();
  assert.equal(data.success, false);
  assert.equal(data.code, "request_body_too_large");
  assert.equal(data.requestId, REQUEST_ID);
  assert.equal(typeof data.message, "string");
});

test("a streamed body over the cap is refused even without Content-Length", async () => {
  const oversized = `{"pad":"${"x".repeat(API_BODY_DEFAULT_MAX_BYTES)}"}`;
  const result = await readJsonBody(post(oversized));
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 413);
  const data = await result.response.json();
  assert.equal(data.code, "request_body_too_large");
});

test("a custom cap applies to the same body", async () => {
  const body = JSON.stringify({ pad: "x".repeat(64) });
  const small = await readJsonBody(post(body), { maxBytes: 32 });
  assert.equal(small.ok, false);
  assert.equal(small.response.status, 413);

  const large = await readJsonBody(post(body), { maxBytes: API_BODY_LARGE_MAX_BYTES });
  assert.equal(large.ok, true);
});

test("malformed JSON is a 400 with a stable code and requestId", async () => {
  const result = await readJsonBody(post("{not json"));
  assert.equal(result.ok, false);
  assert.equal(result.response.status, 400);
  const data = await result.response.json();
  assert.equal(data.success, false);
  assert.equal(data.code, "invalid_json");
  assert.equal(data.message, "Invalid JSON body.");
  assert.equal(data.requestId, REQUEST_ID);
});

for (const payload of ["[1,2,3]", "42", "\"text\"", "null", "true"]) {
  test(`non-object JSON (${payload}) is a 400`, async () => {
    const result = await readJsonBody(post(payload));
    assert.equal(result.ok, false);
    assert.equal(result.response.status, 400);
    const data = await result.response.json();
    assert.equal(data.code, "invalid_json");
  });
}

test("an empty body is invalid by default but allowed as {} with allowEmpty", async () => {
  const strict = await readJsonBody(post(""));
  assert.equal(strict.ok, false);
  assert.equal(strict.response.status, 400);

  const noBody = await readJsonBody(post(undefined));
  assert.equal(noBody.ok, false);
  assert.equal(noBody.response.status, 400);

  const relaxed = await readJsonBody(post(""), { allowEmpty: true });
  assert.equal(relaxed.ok, true);
  assert.deepEqual(relaxed.body, {});

  const relaxedNoBody = await readJsonBody(post(undefined), { allowEmpty: true });
  assert.equal(relaxedNoBody.ok, true);
  assert.deepEqual(relaxedNoBody.body, {});
});

test("jsonErrorResponse keeps the {success:false,message} shape plus code and requestId", async () => {
  const response = jsonErrorResponse(post("{}"), 409, "idempotency_conflict", "Key reuse.");
  assert.equal(response.status, 409);
  const data = await response.json();
  assert.deepEqual(data, {
    success: false,
    message: "Key reuse.",
    code: "idempotency_conflict",
    requestId: REQUEST_ID,
  });
});

test("internalErrorResponse never leaks error.message", async () => {
  const secret = "database password hunter2 leaked here";
  const response = internalErrorResponse(post("{}"), "test_unexpected_error", new Error(secret));
  assert.equal(response.status, 500);
  const data = await response.json();
  assert.equal(data.success, false);
  assert.equal(data.code, "internal_error");
  assert.equal(data.requestId, REQUEST_ID);
  assert.equal(data.message, "Internal server error.");
  assert.equal(JSON.stringify(data).includes("hunter2"), false, "internal detail must not reach the client");
});

test("internalErrorResponse allows a safe static message override", async () => {
  const response = internalErrorResponse(post("{}"), "test_unexpected_error", new Error("secret"), "Unable to create invoice.");
  const data = await response.json();
  assert.equal(data.message, "Unable to create invoice.");
});
