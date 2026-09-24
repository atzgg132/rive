import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { acceptanceStatusDecision, acceptedRecordExpiry, typedNameMatches } from "../../src/utils/agreementAcceptance.ts";
import { AgreementActionError, describeAgreementError } from "../../src/utils/agreementErrors.ts";
import { contractAcceptanceLinkProblem, contractVoidLinkProblem, OWNER_LINK_RETIRED_MESSAGE } from "../../src/utils/contractPublicSession.ts";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("acceptance is taken only while signing, except an owner completing a lapsed request in the workspace", () => {
  assert.equal(acceptanceStatusDecision({ status: "signing", channel: "public_link", signerRole: "client", versionStatus: "final" }), "accept");
  assert.equal(acceptanceStatusDecision({ status: "signing", channel: "workspace", signerRole: "owner", versionStatus: "final" }), "accept");
  assert.equal(acceptanceStatusDecision({ status: "expired", channel: "workspace", signerRole: "owner", versionStatus: "final" }), "reopen");
  for (const blocked of [
    { status: "expired", channel: "public_link", signerRole: "client", versionStatus: "final" },
    { status: "expired", channel: "workspace", signerRole: "owner", versionStatus: "draft" },
    { status: "ready_to_sign", channel: "workspace", signerRole: "owner", versionStatus: "final" },
    { status: "executed", channel: "workspace", signerRole: "owner", versionStatus: "final" },
    { status: "void", channel: "public_link", signerRole: "client", versionStatus: "final" },
  ]) {
    assert.equal(acceptanceStatusDecision(blocked), "closed", JSON.stringify(blocked));
  }
});

test("typed names match the snapshotted party ignoring case and surrounding space only", () => {
  assert.equal(typedNameMatches("  acme studio ", "Acme Studio"), true);
  assert.equal(typedNameMatches("Acme", "Acme Studio"), false);
});

test("the accepted record stays reachable for a year", () => {
  const executedAt = new Date("2026-09-24T00:00:00.000Z");
  assert.equal(acceptedRecordExpiry(executedAt).toISOString(), "2027-09-24T00:00:00.000Z");
});

test("only AgreementActionError messages reach the browser", () => {
  const known = describeAgreementError(new AgreementActionError("The client must record acceptance before you can.", 409, "client_first"), "fallback");
  assert.deepEqual(known, { status: 409, body: { success: false, message: "The client must record acceptance before you can.", code: "client_first" }, internal: false });
  const unknown = describeAgreementError(new Error('Invalid `prisma.contract.update()` invocation: column "x" does not exist'), "Unable to finalize Agreement.");
  assert.deepEqual(unknown, { status: 500, body: { success: false, message: "Unable to finalize Agreement." }, internal: true });
});

test("owner public links are retired for acceptance and void; client links still work", () => {
  const base = { type: "sign", revokedAt: null, expiresAt: new Date(Date.now() + 60_000), version: {}, contract: { status: "signing" } };
  assert.equal(contractAcceptanceLinkProblem({ ...base, signer: { role: "owner" } }), OWNER_LINK_RETIRED_MESSAGE);
  assert.equal(contractAcceptanceLinkProblem({ ...base, signer: { role: "client" } }), null);
  const executed = { ...base, contract: { status: "executed" } };
  assert.equal(contractVoidLinkProblem({ ...executed, signer: { role: "owner" } }), OWNER_LINK_RETIRED_MESSAGE);
  assert.equal(contractVoidLinkProblem({ ...executed, signer: { role: "client" } }), null);
});

test("routes no longer choose HTTP status by searching error messages", async () => {
  for (const path of [
    "src/app/api/public/contracts/sign/[token]/route.ts",
    "src/app/api/workflow/contracts/[id]/start-signing/route.ts",
    "src/app/api/workflow/contracts/[id]/finalize/route.ts",
    "src/app/api/workflow/contracts/[id]/route.ts",
  ]) {
    const route = await source(path);
    assert.doesNotMatch(route, /message\.includes\(/, path);
    assert.doesNotMatch(route, /error instanceof Error \? error\.message/, path);
  }
});

test("a lapsed request whose client accepted is reminded, not expired", async () => {
  const maintenance = await source("src/app/api/contracts/maintenance/route.ts");
  assert.match(maintenance, /notifyOwnerAcceptanceDue\(/);
  assert.match(maintenance, /NOT: \{ signers: \{ some: \{ role: "client", status: "signed" \} \} \}/);
});

test("the review readiness signal never locks the review or records acceptance", async () => {
  const review = await source("src/app/api/public/contracts/review/[token]/route.ts");
  assert.doesNotMatch(review, /version!\.status === "approved" \? "read_only"/);
  assert.doesNotMatch(review, /contractSignature/);
  assert.match(review, /client_review_approval_withdrawn/);
});
