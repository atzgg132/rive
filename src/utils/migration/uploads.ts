import "server-only";

import crypto, { createHash } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, PutObjectTaggingCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type DurableUploadManifest = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  objectKey: string;
};

function storageConfig(): { bucket: string; region: string } | null {
  const bucket = process.env.ASSET_BUCKET;
  const region = process.env.AWS_REGION;
  return bucket && region ? { bucket, region } : null;
}

export function migrationObjectStorageConfigured(): boolean {
  return Boolean(storageConfig());
}

export function migrationObjectKey(userId: string, migrationId: string, fileName: string): string {
  const extension = fileName.toLowerCase().split(".").pop()?.replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  return `migration/${userId}/${migrationId}/${crypto.randomUUID()}.${extension}`;
}

export async function presignMigrationUpload(input: Omit<DurableUploadManifest, "id">): Promise<{ uploadUrl: string; headers: Record<string, string> }> {
  const config = storageConfig();
  if (!config) throw new Error("Migration object storage is not configured.");
  const client = new S3Client({ region: config.region, requestChecksumCalculation: "WHEN_REQUIRED" });
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.objectKey,
    ContentType: input.mimeType,
    ContentLength: input.sizeBytes,
    Tagging: "migration-state=incomplete",
  });
  return {
    uploadUrl: await getSignedUrl(client, command, { expiresIn: 300 }),
    headers: { "Content-Type": input.mimeType, "x-amz-tagging": "migration-state=incomplete" },
  };
}

export async function markMigrationObjectVerified(objectKey: string): Promise<void> {
  const config = storageConfig();
  if (!config) throw new Error("Migration object storage is not configured.");
  await new S3Client({ region: config.region }).send(new PutObjectTaggingCommand({
    Bucket: config.bucket,
    Key: objectKey,
    Tagging: { TagSet: [{ Key: "migration-state", Value: "verified" }] },
  }));
}

export async function readMigrationObject(objectKey: string): Promise<Uint8Array> {
  const config = storageConfig();
  if (!config) throw new Error("Migration object storage is not configured.");
  if (!/^migration\/[0-9a-f-]+\/[0-9a-f-]+\/[0-9a-f-]+\.[a-z0-9]+$/i.test(objectKey)) {
    throw new Error("Migration object key is invalid.");
  }
  const result = await new S3Client({ region: config.region }).send(new GetObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
  }));
  if (!result.Body) throw new Error("Uploaded file has no body.");
  return result.Body.transformToByteArray();
}

export async function verifyMigrationObject(input: { objectKey: string; checksum: string; sizeBytes: number }): Promise<Uint8Array> {
  const bytes = await readMigrationObject(input.objectKey);
  if (bytes.byteLength !== input.sizeBytes) throw new Error("The uploaded file size did not match the file you selected.");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (checksum !== input.checksum) throw new Error("The uploaded file checksum did not match. Upload it again.");
  return bytes;
}
