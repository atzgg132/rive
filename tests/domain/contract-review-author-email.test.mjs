import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { prisma } from "../helpers/prisma-mock.mjs";
import { NextRequest } from "../helpers/next-server-shim.mjs";

const { POST } = await import("../../src/app/api/public/contracts/review/[token]/route.ts");

const STORE_CLIENT_EMAIL = "stored-client@example.com";

function activeReviewLink() {
  return {
    id: "link-1",
    contractId: "contract-1",
    versionId: "version-1",
    type: "review",
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    contract: {
      id: "contract-1",
      userId: "user-1",
      title: "Service Agreement",
      status: "in_review",
      client: { name: "Stored Client", email: STORE_CLIENT_EMAIL },
    },
    version: {
      id: "version-1",
      status: "draft",
    },
  };
}

function reviewRequest(body) {
  return new NextRequest("http://localhost/api/public/contracts/review/review-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function calls(spy) {
  return spy.calls;
}

let updateManySpy;
let contractEventSpy;
let contractCommentSpy;

beforeEach(() => {
  prisma.__reset();
  updateManySpy = { calls: [] };
  contractEventSpy = { calls: [] };
  contractCommentSpy = { calls: [] };
  prisma.contractReviewLink.findUnique = async () => activeReviewLink();
  prisma.contractVersion = {
    updateMany: async (args) => {
      updateManySpy.calls.push(args);
      return { count: 1 };
    },
  };
  prisma.contractEvent = {
    create: async (args) => {
      contractEventSpy.calls.push(args);
      return { id: "event-1" };
    },
  };
  prisma.contractComment = {
    create: async (args) => {
      contractCommentSpy.calls.push(args);
      return { id: "comment-1", ...args.data, status: "open", createdAt: new Date() };
    },
  };
  prisma.$queryRaw = async () => [{ count: 1, retry_after: 0 }];
});

test("a malformed approval email is rejected and never falls back to the stored client email", async () => {
  const response = await POST(
    reviewRequest({ action: "approve", authorEmail: "jj.jkj@." }),
    { params: Promise.resolve({ token: "review-token" }) },
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.deepEqual(payload, { success: false, message: "Enter a valid email or leave it blank." });
  assert.equal(calls(updateManySpy).length, 0, "no approval write may run");
  assert.equal(calls(contractEventSpy).length, 0, "no approval event may be recorded");
  assert.equal(calls(contractCommentSpy).length, 0);
});

test("a malformed email on a comment submission is rejected by the same early check", async () => {
  const response = await POST(
    reviewRequest({ authorName: "Reviewing Client", body: "Please change the deposit.", authorEmail: "not-an-email@" }),
    { params: Promise.resolve({ token: "review-token" }) },
  );

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.deepEqual(payload, { success: false, message: "Enter a valid email or leave it blank." });
  assert.equal(calls(contractCommentSpy).length, 0);
  assert.equal(calls(contractEventSpy).length, 0);
});

test("a valid approval email is normalized and recorded instead of the stored client email", async () => {
  const response = await POST(
    reviewRequest({ action: "approve", authorEmail: "  Reviewer@Example.COM " }),
    { params: Promise.resolve({ token: "review-token" }) },
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.approved, true);
  assert.equal(calls(contractEventSpy).length, 1);
  const metadata = calls(contractEventSpy)[0].data.metadata;
  assert.equal(metadata.reviewerEmail, "reviewer@example.com");
  assert.notEqual(metadata.reviewerEmail, STORE_CLIENT_EMAIL);
});

test("a blank approval email still falls back to the stored client email", async () => {
  const response = await POST(
    reviewRequest({ action: "approve" }),
    { params: Promise.resolve({ token: "review-token" }) },
  );

  assert.equal(response.status, 200);
  assert.equal(calls(contractEventSpy).length, 1);
  const metadata = calls(contractEventSpy)[0].data.metadata;
  assert.equal(metadata.reviewerEmail, STORE_CLIENT_EMAIL);
});
