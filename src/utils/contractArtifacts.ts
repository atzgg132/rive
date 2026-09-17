import "server-only";

import crypto from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Prisma } from "@prisma/client";
import {
  CONTRACT_CONSENT_TEXT,
  stableStringify,
  sha256,
  type ContractContent,
} from "@/utils/contracts";

/**
 * Executed-Agreement artifacts.
 *
 * The canonical version stays the source of truth; the signed_pdf artifact is
 * rendered exactly once when execution completes, its *bytes* are hashed, and
 * the bytes are stored privately (S3 via ASSET_BUCKET when configured, else the
 * content_bytes column for local/dev). Artifact routes always serve the stored
 * bytes — they never regenerate an accepted record. The artifact table is
 * append-only at the database level, so this module never updates or deletes a
 * row; a legacy row without bytes is served through the deterministic
 * re-render fallback instead of being rewritten.
 */

export const CONTRACT_SIGNED_ARTIFACT_TYPE = "signed_pdf";
export const CONTRACT_ARTIFACT_MIME = "application/pdf";
export const CONTRACT_ARTIFACT_RENDERER_VERSION = "contract-pdf.v1";

// Storage markers. "inline" is what rows created before byte storage look like
// (schema default); new rows are explicitly "s3" or "db".
export const CONTRACT_ARTIFACT_STORAGE_S3 = "s3";
export const CONTRACT_ARTIFACT_STORAGE_DB = "db";
export const CONTRACT_ARTIFACT_STORAGE_INLINE = "inline";

export type ContractArtifactRow = {
  id: string;
  contractId: string;
  versionId: string;
  artifactType: string;
  mimeType: string;
  storage: string;
  objectKey: string | null;
  contentBytes: Uint8Array | null;
  byteSize: number | null;
  rendererVersion: string | null;
  contentHash: string;
  content: unknown;
  generatedAt: Date;
};

export function contractArtifactBytesHash(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/**
 * Deterministic object key: contract + version + content hash. A retry of the
 * same render lands on the same key, and a different render can never collide
 * with — let alone overwrite — the recorded evidence object.
 */
export function contractArtifactObjectKey(input: { contractId: string; versionId: string; contentHash: string }): string {
  return `contracts/${input.contractId}/versions/${input.versionId}/signed_pdf/${input.contentHash}.pdf`;
}

const CONTRACT_ARTIFACT_KEY_PATTERN = /^contracts\/[0-9a-f-]{36}\/versions\/[0-9a-f-]{36}\/signed_pdf\/[0-9a-f]{64}\.pdf$/;

function artifactStorageConfig(): { bucket: string; region: string } | null {
  const bucket = process.env.ASSET_BUCKET;
  const region = process.env.AWS_REGION;
  return bucket && region ? { bucket, region } : null;
}

export function contractArtifactObjectStorageConfigured(): boolean {
  return Boolean(artifactStorageConfig());
}

async function putContractArtifactObject(objectKey: string, bytes: Uint8Array): Promise<void> {
  const config = artifactStorageConfig();
  if (!config) throw new Error("Contract artifact object storage is not configured.");
  try {
    await new S3Client({ region: config.region, requestChecksumCalculation: "WHEN_REQUIRED" }).send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: bytes,
      ContentType: CONTRACT_ARTIFACT_MIME,
      ContentLength: bytes.byteLength,
      // Same key = same hash = same bytes. If the object is already there this
      // is a retry and must not overwrite the recorded evidence object.
      IfNoneMatch: "*",
    }));
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    const name = (error as { name?: string })?.name;
    if (status === 412 || name === "PreconditionFailed") return;
    throw error;
  }
}

async function getContractArtifactObject(objectKey: string): Promise<Uint8Array> {
  const config = artifactStorageConfig();
  if (!config) throw new Error("Contract artifact object storage is not configured.");
  if (!CONTRACT_ARTIFACT_KEY_PATTERN.test(objectKey)) throw new Error("Contract artifact object key is invalid.");
  const result = await new S3Client({ region: config.region }).send(new GetObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
  }));
  if (!result.Body) throw new Error("Contract artifact object has no body.");
  return result.Body.transformToByteArray();
}

function artifactBytesMatch(artifact: { contentHash: string; byteSize: number | null }, bytes: Uint8Array): boolean {
  if (artifact.byteSize != null && artifact.byteSize !== bytes.byteLength) return false;
  return contractArtifactBytesHash(bytes) === artifact.contentHash;
}

/**
 * Return the stored bytes for an artifact row, verified against the recorded
 * byte hash. Returns null when no trustworthy stored bytes exist — callers
 * decide between the legacy re-render fallback ("inline" rows) and a 404.
 */
export async function readContractArtifactBytes(
  artifact: Pick<ContractArtifactRow, "storage" | "objectKey" | "contentBytes" | "byteSize" | "contentHash">,
  deps: { getObject?: (objectKey: string) => Promise<Uint8Array> } = {},
): Promise<Uint8Array | null> {
  if (artifact.contentBytes && artifact.contentBytes.byteLength > 0) {
    const bytes = new Uint8Array(artifact.contentBytes);
    return artifactBytesMatch(artifact, bytes) ? bytes : null;
  }
  if (artifact.storage === CONTRACT_ARTIFACT_STORAGE_S3 && artifact.objectKey) {
    const getObject = deps.getObject ?? getContractArtifactObject;
    let bytes: Uint8Array;
    try {
      bytes = await getObject(artifact.objectKey);
    } catch {
      return null;
    }
    return artifactBytesMatch(artifact, bytes) ? bytes : null;
  }
  return null;
}

export function contractArtifactHasStoredBytes(
  artifact: Pick<ContractArtifactRow, "storage" | "objectKey" | "contentBytes">,
): boolean {
  return Boolean(artifact.contentBytes?.byteLength) || (artifact.storage === CONTRACT_ARTIFACT_STORAGE_S3 && Boolean(artifact.objectKey));
}

/** Row data for a freshly rendered artifact. contentHash is the hash of the actual bytes. */
export function buildContractArtifactRecord(input: {
  contractId: string;
  versionId: string;
  bytes: Uint8Array;
  evidence: Record<string, unknown>;
  useObjectStorage: boolean;
}): { data: Record<string, unknown>; objectKey: string | null; contentHash: string } {
  const contentHash = contractArtifactBytesHash(input.bytes);
  const objectKey = input.useObjectStorage
    ? contractArtifactObjectKey({ contractId: input.contractId, versionId: input.versionId, contentHash })
    : null;
  return {
    objectKey,
    contentHash,
    data: {
      contractId: input.contractId,
      versionId: input.versionId,
      artifactType: CONTRACT_SIGNED_ARTIFACT_TYPE,
      mimeType: CONTRACT_ARTIFACT_MIME,
      storage: input.useObjectStorage ? CONTRACT_ARTIFACT_STORAGE_S3 : CONTRACT_ARTIFACT_STORAGE_DB,
      objectKey,
      contentBytes: input.useObjectStorage ? null : input.bytes,
      byteSize: input.bytes.byteLength,
      rendererVersion: CONTRACT_ARTIFACT_RENDERER_VERSION,
      contentHash,
      content: input.evidence,
    },
  };
}

type ContractSource = {
  id: string;
  status: string;
  title: string;
  governingLaw: string;
  jurisdiction: string | null;
  provider: string;
  providerEnvelopeId: string | null;
  executedAt: Date | null;
};

type VersionSource = {
  id: string;
  contractId: string;
  content: unknown;
  contentHash: string;
};

type SignatureSource = {
  id: string;
  signerRole: string;
  signerName: string;
  signerEmail: string;
  signatureType: string;
  consentAccepted: boolean;
  consentTextVersion: string;
  ipHash: string | null;
  userAgentHash: string | null;
  providerEventId: string | null;
  signedAt: Date;
};

type ContractArtifactDb = {
  contract: { findUnique(args: { where: { id: string } }): Promise<ContractSource | null> };
  contractVersion: { findUnique(args: { where: { id: string } }): Promise<VersionSource | null> };
  contractSignature: {
    findMany(args: {
      where: { contractId: string; versionId: string };
      orderBy: { signedAt: "asc" };
      take?: number;
      select?: Record<string, boolean>;
    }): Promise<SignatureSource[]>;
  };
  contractArtifact: {
    findFirst(args: {
      where: { contractId: string; versionId: string; artifactType: string };
      orderBy?: { generatedAt: "desc" };
    }): Promise<ContractArtifactRow | null>;
    create(args: { data: Record<string, unknown> }): Promise<ContractArtifactRow>;
  };
};

export function buildExecutedContractEvidence(input: {
  contract: ContractSource;
  version: VersionSource;
  signatures: SignatureSource[];
}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    contractId: input.contract.id,
    versionId: input.version.id,
    documentHash: input.version.contentHash,
    provider: input.contract.provider,
    providerEnvelopeId: input.contract.providerEnvelopeId,
    executedAt: input.contract.executedAt?.toISOString() || null,
    consentText: CONTRACT_CONSENT_TEXT,
    signatures: input.signatures.map((signature) => ({ ...signature, signedAt: signature.signedAt.toISOString() })),
  };
}

const EXECUTED_SIGNATURE_SELECT = {
  id: true,
  signerRole: true,
  signerName: true,
  signerEmail: true,
  signatureType: true,
  consentAccepted: true,
  consentTextVersion: true,
  ipHash: true,
  userAgentHash: true,
  providerEventId: true,
  signedAt: true,
} satisfies Record<string, boolean>;

type RenderDeps = {
  renderContractPdf?: (input: Record<string, unknown>) => Promise<Uint8Array>;
  putObject?: (objectKey: string, bytes: Uint8Array) => Promise<void>;
  objectStorageConfigured?: () => boolean;
};

async function defaultRender(input: Record<string, unknown>): Promise<Uint8Array> {
  // Lazy import: @react-pdf/renderer pulls in a JSX module that must stay out
  // of the no-DB domain-test module graph.
  const { renderContractPdf } = await import("@/utils/contractPdf");
  return renderContractPdf(input as Parameters<typeof renderContractPdf>[0]);
}

function pdfRenderInput(input: {
  contract: ContractSource;
  version: VersionSource;
  evidenceHash: string;
  signatures: SignatureSource[];
}): Record<string, unknown> {
  return {
    content: input.version.content as ContractContent,
    governingLaw: input.contract.governingLaw,
    jurisdiction: input.contract.jurisdiction,
    status: input.contract.status,
    executedAt: input.contract.executedAt?.toISOString() || null,
    documentHash: input.version.contentHash,
    evidenceHash: input.evidenceHash,
    provider: input.contract.provider,
    signatures: input.signatures.map((signature) => ({
      id: signature.id,
      role: signature.signerRole,
      name: signature.signerName,
      email: signature.signerEmail,
      consentTextVersion: signature.consentTextVersion,
      providerEventId: signature.providerEventId,
      ipHash: signature.ipHash,
      userAgentHash: signature.userAgentHash,
      signedAt: signature.signedAt.toISOString(),
    })),
  };
}

/**
 * Return the recorded signed_pdf artifact for an executed contract version,
 * generating and storing it exactly once when none exists yet (the self-heal
 * path for executed contracts that predate byte storage). Rendering happens
 * once: the bytes are hashed, stored privately, and the row records storage,
 * key, size, renderer version, and the evidence manifest in `content`.
 *
 * The (contractId, versionId, artifactType) unique index makes a duplicate
 * artifact impossible even under a race; a loser of that race reads the row
 * the winner wrote.
 */
export async function ensureContractExecutedArtifact(
  db: ContractArtifactDb,
  input: { contractId: string; versionId: string },
  deps: RenderDeps = {},
): Promise<ContractArtifactRow | null> {
  const existing = await db.contractArtifact.findFirst({
    where: { contractId: input.contractId, versionId: input.versionId, artifactType: CONTRACT_SIGNED_ARTIFACT_TYPE },
    orderBy: { generatedAt: "desc" },
  });
  if (existing) return existing;

  const [contract, version, signatures] = await Promise.all([
    db.contract.findUnique({ where: { id: input.contractId } }),
    db.contractVersion.findUnique({ where: { id: input.versionId } }),
    db.contractSignature.findMany({
      where: { contractId: input.contractId, versionId: input.versionId },
      orderBy: { signedAt: "asc" },
      take: 10,
      select: EXECUTED_SIGNATURE_SELECT,
    }),
  ]);
  if (!contract || contract.status !== "executed" || !version || version.contractId !== contract.id) return null;

  const evidence = buildExecutedContractEvidence({ contract, version, signatures });
  const evidenceHash = sha256(stableStringify(evidence));
  const render = deps.renderContractPdf ?? defaultRender;
  const bytes = await render(pdfRenderInput({ contract, version, evidenceHash, signatures }));

  const useObjectStorage = (deps.objectStorageConfigured ?? contractArtifactObjectStorageConfigured)();
  const record = buildContractArtifactRecord({
    contractId: input.contractId,
    versionId: input.versionId,
    bytes,
    evidence,
    useObjectStorage,
  });
  if (record.objectKey) {
    const putObject = deps.putObject ?? putContractArtifactObject;
    await putObject(record.objectKey, bytes);
  }
  try {
    return await db.contractArtifact.create({ data: { ...record.data, content: record.data.content as Prisma.InputJsonValue } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return db.contractArtifact.findFirst({
        where: { contractId: input.contractId, versionId: input.versionId, artifactType: CONTRACT_SIGNED_ARTIFACT_TYPE },
        orderBy: { generatedAt: "desc" },
      });
    }
    throw error;
  }
}

/**
 * Deterministic re-render for legacy "inline" artifacts that predate byte
 * storage: there is no stored byte string to serve and the append-only table
 * cannot be repaired in place, so the PDF is derived again from the canonical
 * version + recorded signatures with the recorded evidence hash embedded.
 */
export async function renderLegacyContractArtifactBytes(
  db: Pick<ContractArtifactDb, "contractSignature">,
  input: { contract: ContractSource; version: VersionSource; artifact: Pick<ContractArtifactRow, "contentHash"> },
  deps: Pick<RenderDeps, "renderContractPdf"> = {},
): Promise<Uint8Array> {
  const signatures = await db.contractSignature.findMany({
    where: { contractId: input.contract.id, versionId: input.version.id },
    orderBy: { signedAt: "asc" },
    take: 10,
    select: EXECUTED_SIGNATURE_SELECT,
  });
  const render = deps.renderContractPdf ?? defaultRender;
  return render(pdfRenderInput({
    contract: input.contract,
    version: input.version,
    evidenceHash: input.artifact.contentHash,
    signatures,
  }));
}
