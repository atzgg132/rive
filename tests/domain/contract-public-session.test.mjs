import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { beforeEach } from "node:test";

import { prisma } from "../helpers/prisma-mock.mjs";
import { NextRequest, NextResponse } from "../helpers/next-server-shim.mjs";

const {
  CONTRACT_PUBLIC_SESSION_COOKIE_NAMES,
  CONTRACT_PUBLIC_SESSION_COOKIE_PATH,
  CONTRACT_PUBLIC_SESSION_TTL_MS,
  contractPublicSessionLogOutcome,
  createContractPublicSession,
  isContractPublicSessionSegment,
  readContractPublicSessionToken,
  resolveContractPublicSession,
  setContractPublicSessionCookie,
} = await import("../../src/utils/contractPublicSession.ts");
const { hashAccessToken, hashRequestValue } = await import("../../src/utils/contracts.ts");

const { GET: signExchangeGet } = await import("../../src/app/api/public/contracts/sign/[token]/session/route.ts");
const { GET: reviewExchangeGet } = await import("../../src/app/api/public/contracts/review/[token]/session/route.ts");
const { GET: signGet, POST: signPost } = await import("../../src/app/api/public/contracts/sign/[token]/route.ts");
const { GET: artifactGet } = await import("../../src/app/api/public/contracts/artifact/[token]/route.ts");

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);
const PAST = new Date(Date.now() - 60 * 1000);

function sessionDb(findUnique) {
  const calls = { create: [], update: [], updateMany: [] };
  return {
    calls,
    db: {
      contractPublicSession: {
        findUnique: findUnique || (async () => null),
        create: async (args) => { calls.create.push(args); return { id: "sess-new" }; },
        update: async (args) => { calls.update.push(args); return {}; },
        updateMany: async (args) => { calls.updateMany.push(args); return { count: 1 }; },
      },
    },
  };
}

function liveSession(overrides = {}) {
  return {
    id: "sess-1",
    tokenHash: "hashed",
    contractId: "contract-1",
    versionId: "version-1",
    linkId: "link-1",
    purpose: "acceptance",
    expiresAt: FUTURE,
    revokedAt: null,
    lastAccessedAt: null,
    link: { revokedAt: null, expiresAt: FUTURE },
    ...overrides,
  };
}

function signLink(overrides = {}) {
  return {
    id: "link-1",
    contractId: "contract-1",
    versionId: "version-1",
    type: "sign",
    revokedAt: null,
    expiresAt: FUTURE,
    contract: {
      id: "contract-1",
      userId: "user-1",
      status: "signing",
      title: "Fixture Agreement",
      governingLaw: "India",
      jurisdiction: "Karnataka",
      currency: "USD",
      executedAt: null,
      voidRequestedAt: null,
      voidRequestedByRole: null,
      voidRequestNote: null,
      voidConfirmNote: null,
      client: { name: "Fixture Client", email: "client@fixture.test" },
      user: { email: "owner@fixture.test" },
    },
    version: { id: "version-1", version: 1, contentHash: "doc-hash", content: { sections: [] } },
    signer: { id: "signer-1", role: "client", name: "Fixture Client", email: "client@fixture.test", status: "pending", sequence: 1 },
    ...overrides,
  };
}

function artifactLink(overrides = {}) {
  return {
    id: "link-artifact",
    contractId: "contract-1",
    versionId: "version-1",
    type: "artifact",
    revokedAt: null,
    expiresAt: FUTURE,
    contract: { id: "contract-1", status: "executed", title: "Fixture Agreement", governingLaw: "India", jurisdiction: null, provider: "local", providerEnvelopeId: null, executedAt: new Date("2026-09-10T00:00:00Z") },
    version: { id: "version-1", contractId: "contract-1", contentHash: "doc-hash", content: {} },
    ...overrides,
  };
}

function setCookieValue(response, name) {
  const header = response.headers.getSetCookie?.()[0] || response.headers.get("set-cookie") || "";
  const match = new RegExp(`${name}=([^;]+)`).exec(header);
  return { header, value: match ? match[1] : null };
}

beforeEach(() => {
  prisma.__reset();
});

test("session creation stores only the token hash and binds link, contract, version, purpose, and expiry", async () => {
  const { db, calls } = sessionDb();
  const link = { id: "link-1", contractId: "contract-1", versionId: "version-1", expiresAt: FUTURE };
  const { token, expiresAt } = await createContractPublicSession(db, { link, purpose: "acceptance" });

  // Any still-live session for the same link+purpose is rotated out first.
  assert.equal(calls.updateMany.length, 1);
  assert.deepEqual(calls.updateMany[0].where, { linkId: "link-1", purpose: "acceptance", revokedAt: null });
  assert.ok(calls.updateMany[0].data.revokedAt instanceof Date);

  assert.equal(calls.create.length, 1);
  const data = calls.create[0].data;
  assert.equal(data.tokenHash, hashAccessToken(token), "stored hash must be the hash of the issued token");
  assert.notEqual(data.tokenHash, token, "the raw token must never be stored");
  assert.equal(JSON.stringify(data).includes(token), false, "no field of the row may contain the raw token");
  assert.equal(data.linkId, "link-1");
  assert.equal(data.contractId, "contract-1");
  assert.equal(data.versionId, "version-1");
  assert.equal(data.purpose, "acceptance");
  assert.equal(data.expiresAt, expiresAt);
  assert.ok(expiresAt <= link.expiresAt, "session expiry must not outlive the link");
  assert.ok(expiresAt.getTime() <= Date.now() + CONTRACT_PUBLIC_SESSION_TTL_MS, "session expiry respects the TTL cap");
});

test("each purpose gets its own cookie name so concurrent sessions do not overwrite each other", () => {
  const names = Object.values(CONTRACT_PUBLIC_SESSION_COOKIE_NAMES);
  assert.deepEqual(new Set(names).size, 3);
  assert.notEqual(CONTRACT_PUBLIC_SESSION_COOKIE_NAMES.review, CONTRACT_PUBLIC_SESSION_COOKIE_NAMES.acceptance);
  assert.notEqual(CONTRACT_PUBLIC_SESSION_COOKIE_NAMES.acceptance, CONTRACT_PUBLIC_SESSION_COOKIE_NAMES.artifact);
  assert.notEqual(CONTRACT_PUBLIC_SESSION_COOKIE_NAMES.review, CONTRACT_PUBLIC_SESSION_COOKIE_NAMES.artifact);
});

test("session resolution rejects missing, unknown, wrong-purpose, revoked, and expired sessions", async () => {
  const missing = await resolveContractPublicSession(sessionDb().db, { purpose: "acceptance", token: null });
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, "missing");

  const notFound = await resolveContractPublicSession(sessionDb().db, { purpose: "acceptance", token: "anything" });
  assert.equal(notFound.ok, false);
  assert.equal(notFound.reason, "not_found");

  const wrongPurpose = await resolveContractPublicSession(sessionDb(async () => liveSession({ purpose: "review" })).db, { purpose: "acceptance", token: "tok" });
  assert.equal(wrongPurpose.ok, false);
  assert.equal(wrongPurpose.reason, "wrong_purpose");

  const revoked = await resolveContractPublicSession(sessionDb(async () => liveSession({ revokedAt: new Date() })).db, { purpose: "acceptance", token: "tok" });
  assert.equal(revoked.reason, "revoked");

  const expired = await resolveContractPublicSession(sessionDb(async () => liveSession({ expiresAt: PAST })).db, { purpose: "acceptance", token: "tok" });
  assert.equal(expired.reason, "expired");

  const linkRevoked = await resolveContractPublicSession(sessionDb(async () => liveSession({ link: { revokedAt: new Date(), expiresAt: FUTURE } })).db, { purpose: "acceptance", token: "tok" });
  assert.equal(linkRevoked.reason, "link_revoked");

  const linkExpired = await resolveContractPublicSession(sessionDb(async () => liveSession({ link: { revokedAt: null, expiresAt: PAST } })).db, { purpose: "acceptance", token: "tok" });
  assert.equal(linkExpired.reason, "link_expired");
});

test("session resolution looks up by token hash and stamps lastAccessedAt on success", async () => {
  let seenWhere = null;
  const { db, calls } = sessionDb(async (args) => {
    seenWhere = args.where;
    return liveSession();
  });
  const resolved = await resolveContractPublicSession(db, { purpose: "acceptance", token: "raw-cookie-token" });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.session.linkId, "link-1");
  assert.equal(seenWhere.tokenHash, hashAccessToken("raw-cookie-token"), "lookup is by hash, never the raw value");
  assert.equal(calls.update.length, 1);
  assert.ok(calls.update[0].data.lastAccessedAt instanceof Date);
});

test("session cookie read/write round-trips through the purpose-scoped name", () => {
  const request = new NextRequest("https://rive.test/api/public/contracts/sign/session", {
    headers: { cookie: "other=1; rive_contract_sign_session=cookie-value; rive_contract_review_session=other-purpose" },
  });
  assert.equal(readContractPublicSessionToken(request, "acceptance"), "cookie-value");
  assert.equal(readContractPublicSessionToken(request, "review"), "other-purpose");
  assert.equal(readContractPublicSessionToken(request, "artifact"), null);

  const httpsRequest = new NextRequest("https://rive.test/api/public/contracts/sign/bearer/session");
  const response = new NextResponse();
  const expiresAt = new Date(Date.now() + 60_000);
  setContractPublicSessionCookie(httpsRequest, response, { purpose: "acceptance", token: "session-token", expiresAt });
  const { header } = setCookieValue(response, "rive_contract_sign_session");
  assert.match(header, /rive_contract_sign_session=session-token/);
  assert.match(header, new RegExp(`Path=${CONTRACT_PUBLIC_SESSION_COOKIE_PATH.replaceAll("/", "\\/")}`));
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=lax/i);
  assert.match(header, /Secure/i, "Secure on HTTPS requests");
  assert.equal(header.includes("session-token"), true);

  const httpRequest = new NextRequest("http://localhost:3000/api/public/contracts/sign/bearer/session");
  const httpResponse = new NextResponse();
  setContractPublicSessionCookie(httpRequest, httpResponse, { purpose: "acceptance", token: "session-token", expiresAt });
  const httpCookie = httpResponse.headers.getSetCookie?.()[0] || httpResponse.headers.get("set-cookie") || "";
  assert.equal(/Secure/i.test(httpCookie), false, "no Secure flag on plain-http local dev");
});

test("the reserved 'session' segment is the only non-bearer token", () => {
  assert.equal(isContractPublicSessionSegment("session"), true);
  assert.equal(isContractPublicSessionSegment("bearer-token"), false);
  assert.equal(contractPublicSessionLogOutcome("wrong_purpose"), "session_wrong_purpose");
});

test("the sign exchange route mints a hash-only session, sets the purpose cookie, and strips the token", async () => {
  const created = [];
  const logs = [];
  const originalInfo = console.info;
  console.info = (...args) => logs.push(args.join(" "));
  try {
    prisma.contractReviewLink.findUnique = async () => signLink();
    prisma.contractReviewLink.update = async () => ({});
    prisma.contractPublicSession = {
      findUnique: async () => null,
      update: async () => ({}),
      updateMany: async () => ({ count: 0 }),
      create: async (args) => { created.push(args.data); return {}; },
    };
    const request = new NextRequest("http://localhost/api/public/contracts/sign/bearer-token-secret/session?utm_source=email");
    const response = await signExchangeGet(request, { params: Promise.resolve({ token: "bearer-token-secret" }) });

    assert.equal(response.status, 303);
    const location = response.headers.get("location");
    assert.ok(location, "exchange must redirect");
    const target = new URL(location);
    assert.equal(target.pathname, "/sign", "redirect lands on the clean page");
    assert.equal(target.search, "?utm_source=email", "attribution params survive without the token");
    assert.equal(location.includes("bearer-token-secret"), false, "raw token never reaches the redirect");

    const { header, value } = setCookieValue(response, "rive_contract_sign_session");
    assert.ok(value, "session cookie is set");
    assert.notEqual(value, "bearer-token-secret", "cookie carries a fresh session token, not the bearer token");
    assert.match(header, /HttpOnly/i);
    assert.match(header, /SameSite=lax/i);
    assert.equal(created.length, 1, "exactly one session row is written");
    assert.equal(created[0].tokenHash, hashAccessToken(value), "row stores the hash of the issued cookie value");
    assert.equal(created[0].purpose, "acceptance");
    assert.equal(logs.join("\n").includes("bearer-token-secret"), false, "access logging never sees the raw token");
  } finally {
    console.info = originalInfo;
  }
});

test("the sign exchange redirects cleanly without minting a session for an invalid link", async () => {
  const created = [];
  prisma.contractReviewLink.findUnique = async () => null;
  prisma.contractPublicSession = { create: async (args) => { created.push(args.data); return {}; }, updateMany: async () => ({}), update: async () => ({}), findUnique: async () => null };
  const request = new NextRequest("http://localhost/api/public/contracts/sign/not-real/session");
  const response = await signExchangeGet(request, { params: Promise.resolve({ token: "not-real" }) });
  assert.equal(response.status, 303);
  assert.equal(new URL(response.headers.get("location")).pathname, "/sign");
  assert.equal(created.length, 0);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("the sign exchange is rate limited per source ip before touching the link", async () => {
  const created = [];
  let linkLookups = 0;
  // The mock INCREMENTs first, so a bucket already at the cap trips on the next call.
  prisma.__db.rateLimitBucket.push({
    key: `contract-session:acceptance:${hashRequestValue("unknown")}`,
    count: 60,
    resetAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  prisma.contractReviewLink.findUnique = async () => { linkLookups += 1; return signLink(); };
  prisma.contractPublicSession = { create: async (args) => { created.push(args.data); return {}; }, updateMany: async () => ({}), update: async () => ({}), findUnique: async () => null };
  const request = new NextRequest("http://localhost/api/public/contracts/sign/bearer-token-secret/session");
  const response = await signExchangeGet(request, { params: Promise.resolve({ token: "bearer-token-secret" }) });
  assert.equal(response.status, 303, "rate-limited callers still land on the clean page");
  assert.equal(new URL(response.headers.get("location")).pathname, "/sign");
  assert.equal(created.length, 0, "no session row is minted over the cap");
  assert.equal(linkLookups, 0, "the link is never resolved once limited");
  assert.equal(response.headers.get("set-cookie"), null);
});

test("the review exchange mints a review-purpose session and lands on /review", async () => {
  const created = [];
  prisma.contractReviewLink.findUnique = async () => ({
    id: "link-r", contractId: "contract-1", versionId: "version-1", type: "review",
    revokedAt: null, expiresAt: FUTURE,
    contract: { id: "contract-1", status: "in_review" },
    version: { id: "version-1" },
  });
  prisma.contractReviewLink.update = async () => ({});
  prisma.contractPublicSession = { create: async (args) => { created.push(args.data); return {}; }, updateMany: async () => ({}), update: async () => ({}), findUnique: async () => null };
  const request = new NextRequest("http://localhost/api/public/contracts/review/bearer-review/session");
  const response = await reviewExchangeGet(request, { params: Promise.resolve({ token: "bearer-review" }) });
  assert.equal(response.status, 303);
  const location = response.headers.get("location");
  assert.equal(new URL(location).pathname, "/review");
  assert.equal(location.includes("bearer-review"), false);
  const { value } = setCookieValue(response, "rive_contract_review_session");
  assert.ok(value);
  assert.equal(created[0].purpose, "review");
  assert.equal(created[0].tokenHash, hashAccessToken(value));
});

test("the token pages are redirectors into the session exchange, so the token leaves the address bar", async () => {
  const signPage = await readFile(new URL("../../src/app/sign/[token]/page.tsx", import.meta.url), "utf8");
  assert.match(signPage, /`\/api\/public\/contracts\/sign\/\$\{encodeURIComponent\(token\)\}\/session\$\{query\}`/);
  assert.match(signPage, /httpEquiv="refresh"/);
  assert.match(signPage, /export const dynamic = "force-dynamic"/);
  const reviewPage = await readFile(new URL("../../src/app/review/[token]/page.tsx", import.meta.url), "utf8");
  assert.match(reviewPage, /`\/api\/public\/contracts\/review\/\$\{encodeURIComponent\(token\)\}\/session\$\{query\}`/);
  assert.match(reviewPage, /httpEquiv="refresh"/);
  // The clean pages render the session-backed client components, never a token.
  const cleanSign = await readFile(new URL("../../src/app/sign/page.tsx", import.meta.url), "utf8");
  assert.match(cleanSign, /ContractSignPublicPage/);
  const cleanReview = await readFile(new URL("../../src/app/review/page.tsx", import.meta.url), "utf8");
  assert.match(cleanReview, /ContractReviewPublicPage/);
  const signClient = await readFile(new URL("../../src/components/contracts/ContractSignPublicPage.tsx", import.meta.url), "utf8");
  assert.match(signClient, /"\/api\/public\/contracts\/sign\/session"/);
  assert.match(signClient, /"\/api\/public\/contracts\/void\/session"/);
  assert.doesNotMatch(signClient, /useParams|params\.token/);
  const reviewClient = await readFile(new URL("../../src/components/contracts/ContractReviewPublicPage.tsx", import.meta.url), "utf8");
  assert.match(reviewClient, /"\/api\/public\/contracts\/review\/session"/);
  assert.doesNotMatch(reviewClient, /useParams|params\.token/);
});

function stubAcceptanceSession(overrides = {}) {
  prisma.contractPublicSession = {
    findUnique: async () => liveSession(overrides),
    update: async () => ({}),
    updateMany: async () => ({}),
    create: async () => ({}),
  };
}

test("the sign API serves the reserved 'session' path from the acceptance cookie", async () => {
  stubAcceptanceSession();
  prisma.contractReviewLink.findUnique = async () => signLink();
  prisma.contractReviewLink.update = async () => ({});
  prisma.contractSigner = { count: async () => 0 };
  const request = new NextRequest("http://localhost/api/public/contracts/sign/session", {
    headers: { cookie: "rive_contract_sign_session=cookie-token" },
  });
  const response = await signGet(request, { params: Promise.resolve({ token: "session" }) });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.mode, "sign");
  assert.equal(JSON.stringify(payload).includes("cookie-token"), false, "payload never echoes the session token");
  assert.equal(payload.sessionId, undefined);
  assert.equal(payload.session, undefined);
});

test("the sign API session path returns the session download URL with no raw token", async () => {
  stubAcceptanceSession();
  prisma.contractReviewLink.findUnique = async () => signLink({ contract: { ...signLink().contract, status: "executed" } });
  prisma.contractReviewLink.update = async () => ({});
  prisma.contractSigner = { count: async () => 0 };
  const request = new NextRequest("http://localhost/api/public/contracts/sign/session", {
    headers: { cookie: "rive_contract_sign_session=cookie-token" },
  });
  const response = await signGet(request, { params: Promise.resolve({ token: "session" }) });
  const payload = await response.json();
  assert.equal(payload.mode, "completed");
  assert.equal(payload.downloadUrl, "/api/public/contracts/sign/session/artifact");
});

test("the sign API rejects a wrong-purpose cookie, a missing cookie, and dead sessions", async () => {
  prisma.contractReviewLink.findUnique = async () => signLink();

  // A session minted for review cannot open the acceptance API.
  stubAcceptanceSession({ purpose: "review" });
  let response = await signGet(
    new NextRequest("http://localhost/api/public/contracts/sign/session", { headers: { cookie: "rive_contract_sign_session=whatever" } }),
    { params: Promise.resolve({ token: "session" }) },
  );
  assert.equal(response.status, 401);

  // No cookie at all.
  stubAcceptanceSession();
  response = await signGet(new NextRequest("http://localhost/api/public/contracts/sign/session"), { params: Promise.resolve({ token: "session" }) });
  assert.equal(response.status, 401);

  // Revoked and expired sessions are refused with 410 like the links they bind to.
  stubAcceptanceSession({ revokedAt: new Date() });
  response = await signGet(
    new NextRequest("http://localhost/api/public/contracts/sign/session", { headers: { cookie: "rive_contract_sign_session=whatever" } }),
    { params: Promise.resolve({ token: "session" }) },
  );
  assert.equal(response.status, 410);

  stubAcceptanceSession({ expiresAt: PAST });
  response = await signGet(
    new NextRequest("http://localhost/api/public/contracts/sign/session", { headers: { cookie: "rive_contract_sign_session=whatever" } }),
    { params: Promise.resolve({ token: "session" }) },
  );
  assert.equal(response.status, 410);

  // POSTs are rejected identically, before any mutation or rate-limit bucket.
  stubAcceptanceSession({ purpose: "artifact" });
  response = await signPost(
    new NextRequest("http://localhost/api/public/contracts/sign/session", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "rive_contract_sign_session=whatever" },
      body: JSON.stringify({ typedName: "Fixture Client", consentAccepted: true }),
    }),
    { params: Promise.resolve({ token: "session" }) },
  );
  assert.equal(response.status, 401);
});

test("the artifact route exchanges a valid bearer token for a cookie and redirects the token out of the URL", async () => {
  const created = [];
  prisma.contractReviewLink.findUnique = async () => artifactLink();
  prisma.contractPublicSession = {
    findUnique: async () => null,
    update: async () => ({}),
    updateMany: async () => ({}),
    create: async (args) => { created.push(args.data); return {}; },
  };
  const request = new NextRequest("http://localhost/api/public/contracts/artifact/bearer-artifact-token");
  const response = await artifactGet(request, { params: Promise.resolve({ token: "bearer-artifact-token" }) });
  assert.equal(response.status, 303);
  const location = response.headers.get("location");
  assert.equal(new URL(location).pathname, "/api/public/contracts/artifact/session");
  assert.equal(location.includes("bearer-artifact-token"), false);
  const { value } = setCookieValue(response, "rive_contract_artifact_session");
  assert.ok(value);
  assert.equal(created[0].purpose, "artifact");
  assert.equal(created[0].tokenHash, hashAccessToken(value));
});

test("the artifact session path serves the stored bytes, never a regeneration", async () => {
  const storedBytes = new TextEncoder().encode("%PDF-1.7 stored evidence bytes");
  const { createHash } = await import("node:crypto");
  const contentHash = createHash("sha256").update(storedBytes).digest("hex");
  prisma.contractPublicSession = {
    findUnique: async () => liveSession({ purpose: "artifact", linkId: "link-artifact" }),
    update: async () => ({}),
    updateMany: async () => ({}),
    create: async () => ({}),
  };
  prisma.contractReviewLink.findUnique = async () => artifactLink();
  prisma.contractReviewLink.update = async () => ({});
  prisma.contractArtifact = {
    findFirst: async () => ({
      id: "artifact-1",
      contractId: "contract-1",
      versionId: "version-1",
      artifactType: "signed_pdf",
      mimeType: "application/pdf",
      storage: "db",
      objectKey: null,
      contentBytes: storedBytes,
      byteSize: storedBytes.byteLength,
      rendererVersion: "contract-pdf.v1",
      contentHash,
      content: { schemaVersion: 1 },
      generatedAt: new Date(),
    }),
    create: async () => { throw new Error("must not render or re-create when stored bytes exist"); },
  };
  const request = new NextRequest("http://localhost/api/public/contracts/artifact/session", {
    headers: { cookie: "rive_contract_artifact_session=cookie-token" },
  });
  const response = await artifactGet(request, { params: Promise.resolve({ token: "session" }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("x-contract-evidence-hash"), contentHash);
  const body = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual(body, storedBytes, "the response is the stored byte string");
});

test("the artifact session path rejects other-purpose cookies and invalid bearer links", async () => {
  prisma.contractPublicSession = {
    findUnique: async () => liveSession({ purpose: "acceptance" }),
    update: async () => ({}),
    updateMany: async () => ({}),
    create: async () => ({}),
  };
  const sessionRequest = new NextRequest("http://localhost/api/public/contracts/artifact/session", {
    headers: { cookie: "rive_contract_artifact_session=whatever" },
  });
  let response = await artifactGet(sessionRequest, { params: Promise.resolve({ token: "session" }) });
  assert.equal(response.status, 401);

  prisma.contractReviewLink.findUnique = async () => null;
  response = await artifactGet(new NextRequest("http://localhost/api/public/contracts/artifact/not-real"), { params: Promise.resolve({ token: "not-real" }) });
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("location"), null, "invalid bearer tokens 404 instead of redirecting");
});

test("route source contract: the signing transaction no longer writes the artifact row and no raw token is returned", async () => {
  const signRoute = await readFile(new URL("../../src/app/api/public/contracts/sign/[token]/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(signRoute, /tx\.contractArtifact\.create/, "the append-only artifact is written post-commit by ensure");
  assert.match(signRoute, /ensureContractExecutedArtifact\(prisma/);
  const artifactApiRoute = await readFile(new URL("../../src/app/api/public/contracts/artifact/[token]/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(artifactApiRoute, /renderContractPdf\(/, "the artifact route must serve stored bytes, not regenerate inline");
});
