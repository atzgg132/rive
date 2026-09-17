import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

const {
  CONTRACT_ARTIFACT_RENDERER_VERSION,
  buildContractArtifactRecord,
  contractArtifactBytesHash,
  contractArtifactHasStoredBytes,
  contractArtifactObjectKey,
  ensureContractExecutedArtifact,
  readContractArtifactBytes,
} = await import("../../src/utils/contractArtifacts.ts");
const { Prisma } = await import("@prisma/client");

const CONTRACT_ID = "11111111-2222-3333-4444-555555555555";
const VERSION_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const pdfBytes = new TextEncoder().encode("%PDF-1.7 deterministic render bytes");
const pdfHash = createHash("sha256").update(pdfBytes).digest("hex");

function executedSources() {
  return {
    contract: {
      id: CONTRACT_ID,
      status: "executed",
      title: "Fixture Agreement",
      governingLaw: "India",
      jurisdiction: "Karnataka",
      provider: "local",
      providerEnvelopeId: null,
      executedAt: new Date("2026-09-10T09:00:00.000Z"),
    },
    version: { id: VERSION_ID, contractId: CONTRACT_ID, contentHash: "doc-hash", content: { sections: [] } },
    signatures: [
      {
        id: "sig-1",
        signerRole: "client",
        signerName: "Fixture Client",
        signerEmail: "client@fixture.test",
        signatureType: "typed",
        consentAccepted: true,
        consentTextVersion: "2026-08-03-v2",
        ipHash: "ip-hash",
        userAgentHash: "ua-hash",
        providerEventId: "local_signature_1",
        signedAt: new Date("2026-09-10T08:59:00.000Z"),
      },
    ],
  };
}

function artifactDb({ sources = executedSources(), existing = null, createError = null } = {}) {
  const calls = { findFirst: 0, create: [] };
  return {
    calls,
    db: {
      contract: { findUnique: async () => sources.contract },
      contractVersion: { findUnique: async () => sources.version },
      contractSignature: { findMany: async () => sources.signatures },
      contractArtifact: {
        findFirst: async () => { calls.findFirst += 1; return existing; },
        create: async ({ data }) => {
          calls.create.push(data);
          if (createError) throw createError;
          return { id: "artifact-created", generatedAt: new Date(), ...data };
        },
      },
    },
  };
}

test("the object key is deterministic and embeds contract, version, and content hash", () => {
  const key = contractArtifactObjectKey({ contractId: CONTRACT_ID, versionId: VERSION_ID, contentHash: pdfHash });
  assert.equal(key, contractArtifactObjectKey({ contractId: CONTRACT_ID, versionId: VERSION_ID, contentHash: pdfHash }));
  assert.ok(key.includes(CONTRACT_ID));
  assert.ok(key.includes(VERSION_ID));
  assert.ok(key.includes(pdfHash));
  assert.equal(key, `contracts/${CONTRACT_ID}/versions/${VERSION_ID}/signed_pdf/${pdfHash}.pdf`);
  // A different hash can never address — let alone overwrite — the same object.
  const other = contractArtifactObjectKey({ contractId: CONTRACT_ID, versionId: VERSION_ID, contentHash: "0".repeat(64) });
  assert.notEqual(key, other);
});

test("the artifact record hashes the actual bytes and records storage, size, and renderer version", () => {
  const evidence = { schemaVersion: 1, contractId: CONTRACT_ID };
  const s3 = buildContractArtifactRecord({ contractId: CONTRACT_ID, versionId: VERSION_ID, bytes: pdfBytes, evidence, useObjectStorage: true });
  assert.equal(s3.contentHash, pdfHash, "contentHash is the byte hash, not the evidence hash");
  assert.equal(s3.data.storage, "s3");
  assert.equal(s3.data.objectKey, s3.objectKey);
  assert.equal(s3.data.contentBytes, null, "bytes live in object storage, not the row");
  assert.equal(s3.data.byteSize, pdfBytes.byteLength);
  assert.equal(s3.data.rendererVersion, CONTRACT_ARTIFACT_RENDERER_VERSION);
  assert.equal(s3.data.mimeType, "application/pdf");
  assert.equal(s3.data.artifactType, "signed_pdf");
  assert.deepEqual(s3.data.content, evidence, "evidence JSON stays in content");

  const db = buildContractArtifactRecord({ contractId: CONTRACT_ID, versionId: VERSION_ID, bytes: pdfBytes, evidence, useObjectStorage: false });
  assert.equal(db.data.storage, "db");
  assert.equal(db.data.objectKey, null);
  assert.deepEqual(db.data.contentBytes, pdfBytes, "local/dev fallback keeps bytes on the row");
  assert.equal(db.contentHash, pdfHash);
});

test("stored bytes are returned only when they verify against the recorded byte hash", async () => {
  const artifact = { storage: "db", objectKey: null, contentBytes: pdfBytes, byteSize: pdfBytes.byteLength, contentHash: pdfHash };
  assert.deepEqual(await readContractArtifactBytes(artifact), pdfBytes);

  const tampered = { ...artifact, contentBytes: new TextEncoder().encode("%PDF-forged") };
  assert.equal(await readContractArtifactBytes(tampered), null, "hash mismatch refuses to serve");

  const wrongSize = { ...artifact, byteSize: pdfBytes.byteLength + 1 };
  assert.equal(await readContractArtifactBytes(wrongSize), null, "size mismatch refuses to serve");

  const s3Artifact = { storage: "s3", objectKey: `contracts/${CONTRACT_ID}/versions/${VERSION_ID}/signed_pdf/${pdfHash}.pdf`, contentBytes: null, byteSize: pdfBytes.byteLength, contentHash: pdfHash };
  assert.deepEqual(await readContractArtifactBytes(s3Artifact, { getObject: async () => pdfBytes }), pdfBytes);
  assert.equal(await readContractArtifactBytes(s3Artifact, { getObject: async () => new Uint8Array([1, 2, 3]) }), null);
  assert.equal(await readContractArtifactBytes(s3Artifact, { getObject: async () => { throw new Error("s3 down"); } }), null);

  const legacy = { storage: "inline", objectKey: null, contentBytes: null, byteSize: null, contentHash: "evidence-hash" };
  assert.equal(await readContractArtifactBytes(legacy), null, "legacy byteless rows have nothing stored to serve");
  assert.equal(contractArtifactHasStoredBytes(legacy), false);
  assert.equal(contractArtifactHasStoredBytes(artifact), true);
  assert.equal(contractArtifactHasStoredBytes(s3Artifact), true);
});

test("ensure renders once, stores bytes privately, and keeps the evidence manifest in content", async () => {
  const { db, calls } = artifactDb();
  let renders = 0;
  const puts = [];
  const artifact = await ensureContractExecutedArtifact(db, { contractId: CONTRACT_ID, versionId: VERSION_ID }, {
    renderContractPdf: async () => { renders += 1; return pdfBytes; },
    putObject: async (key, bytes) => { puts.push({ key, bytes }); },
    objectStorageConfigured: () => true,
  });

  assert.equal(renders, 1, "the PDF is rendered exactly once");
  assert.equal(puts.length, 1, "bytes are stored in object storage once");
  assert.deepEqual(puts[0].bytes, pdfBytes);
  assert.equal(puts[0].key, `contracts/${CONTRACT_ID}/versions/${VERSION_ID}/signed_pdf/${pdfHash}.pdf`);
  assert.equal(calls.create.length, 1);
  const data = calls.create[0];
  assert.equal(data.contentHash, pdfHash, "recorded hash is the hash of the actual bytes");
  assert.equal(data.storage, "s3");
  assert.equal(data.objectKey, puts[0].key);
  assert.equal(data.contentBytes, null);
  assert.equal(data.byteSize, pdfBytes.byteLength);
  assert.equal(data.rendererVersion, CONTRACT_ARTIFACT_RENDERER_VERSION);
  const content = data.content;
  assert.equal(content.contractId, CONTRACT_ID);
  assert.equal(content.versionId, VERSION_ID);
  assert.equal(content.documentHash, "doc-hash");
  assert.equal(content.signatures.length, 1, "evidence JSON stays in content");
  assert.equal(artifact.contentHash, pdfHash);
});

test("ensure falls back to DB bytes when object storage is not configured", async () => {
  const { db, calls } = artifactDb();
  const puts = [];
  await ensureContractExecutedArtifact(db, { contractId: CONTRACT_ID, versionId: VERSION_ID }, {
    renderContractPdf: async () => pdfBytes,
    putObject: async (key, bytes) => { puts.push({ key, bytes }); },
    objectStorageConfigured: () => false,
  });
  assert.equal(puts.length, 0, "no object write without configured storage");
  const data = calls.create[0];
  assert.equal(data.storage, "db");
  assert.equal(data.objectKey, null);
  assert.deepEqual(data.contentBytes, pdfBytes);
  assert.equal(data.contentHash, pdfHash);
});

test("ensure never re-renders or re-writes an existing artifact row", async () => {
  const existing = { id: "artifact-existing", contractId: CONTRACT_ID, versionId: VERSION_ID, artifactType: "signed_pdf", storage: "db", contentBytes: pdfBytes, byteSize: pdfBytes.byteLength, contentHash: pdfHash, content: {}, generatedAt: new Date() };
  const { db, calls } = artifactDb({ existing });
  let renders = 0;
  const artifact = await ensureContractExecutedArtifact(db, { contractId: CONTRACT_ID, versionId: VERSION_ID }, {
    renderContractPdf: async () => { renders += 1; return pdfBytes; },
    objectStorageConfigured: () => false,
  });
  assert.equal(artifact, existing);
  assert.equal(renders, 0, "existing rows are returned without rendering");
  assert.equal(calls.create.length, 0, "append-only row is never rewritten");
});

test("a creation race returns the row the winner wrote", async () => {
  const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
  const winner = { id: "artifact-winner", contentHash: pdfHash };
  const calls = { findFirst: 0 };
  const db = {
    contract: { findUnique: async () => executedSources().contract },
    contractVersion: { findUnique: async () => executedSources().version },
    contractSignature: { findMany: async () => executedSources().signatures },
    contractArtifact: {
      findFirst: async () => { calls.findFirst += 1; return calls.findFirst === 1 ? null : winner; },
      create: async () => { throw p2002; },
    },
  };
  const artifact = await ensureContractExecutedArtifact(db, { contractId: CONTRACT_ID, versionId: VERSION_ID }, {
    renderContractPdf: async () => pdfBytes,
    objectStorageConfigured: () => false,
  });
  assert.equal(artifact, winner);
});

test("ensure returns null unless the contract is executed", async () => {
  const sources = executedSources();
  sources.contract = { ...sources.contract, status: "signing" };
  const { db } = artifactDb({ sources });
  const artifact = await ensureContractExecutedArtifact(db, { contractId: CONTRACT_ID, versionId: VERSION_ID }, {
    renderContractPdf: async () => pdfBytes,
    objectStorageConfigured: () => false,
  });
  assert.equal(artifact, null);
});

test("the byte hash helper matches a plain sha256 of the byte string", () => {
  assert.equal(contractArtifactBytesHash(pdfBytes), pdfHash);
});
