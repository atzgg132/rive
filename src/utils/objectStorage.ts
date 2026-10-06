import "server-only";

import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";

export function objectStorageUsesR2(): boolean {
  return process.env.ASSET_STORAGE_PROVIDER === "r2";
}

export function objectStorageClientConfig(): S3ClientConfig {
  const region = objectStorageUsesR2() ? "auto" : process.env.AWS_REGION;
  if (!region) throw new Error("Object storage region is missing.");
  const config: S3ClientConfig = {
    region,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  };
  if (objectStorageUsesR2()) {
    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error("R2 endpoint and credentials are required.");
    }
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".r2.cloudflarestorage.com")) {
      throw new Error("R2 endpoint must be a Cloudflare HTTPS endpoint.");
    }
    config.endpoint = endpoint;
    config.region = "auto";
    config.forcePathStyle = true;
    config.credentials = { accessKeyId, secretAccessKey };
  }
  return config;
}

export function getObjectStorageClient(): S3Client {
  return new S3Client(objectStorageClientConfig());
}
