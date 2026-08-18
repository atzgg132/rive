import crypto from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp } from "@/utils/rateLimit";
import { durableRateLimit } from "@/utils/durableRateLimit";
import {
  PORTFOLIO_MEDIA_LIMITS,
  PORTFOLIO_STORAGE_QUOTA_BYTES,
  isPortfolioAssetKind,
  maxBytesFor,
  type PortfolioAssetKind,
} from "@/utils/portfolioMedia";

/* Requests without a `kind` predate mixed media and must keep the original
   image-only contract exactly: same accepted types, same cap, same errors. */
const legacyImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

function megabytes(bytes: number): number {
  return Math.floor(bytes / 1024 / 1024);
}

type QuotaOutcome = { ok: true } | { ok: false; status: number; message: string };

/**
 * Reserve quota and record the asset in one serialized step.
 *
 * The check and the insert have to be atomic: without that, concurrent presign
 * requests all read the same usage, all pass, and all insert — overshooting the
 * cap by however many requests fit inside the rate limit. A per-user advisory
 * lock serializes them without touching unrelated accounts.
 */
async function reserveAssetSlot(
  { userId, kind, size, contentType, key }: { userId: string; kind: PortfolioAssetKind; size: number; contentType: string; key: string },
): Promise<QuotaOutcome> {
  const limit = PORTFOLIO_MEDIA_LIMITS[kind];

  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const [used, kindCount] = await Promise.all([
      // Every pending row counts, with no grace window. A reservation that was
      // actually written to storage occupies real bytes whether or not it was
      // confirmed, so letting old ones stop counting made the cap bypassable:
      // presign, upload, never confirm, repeat. Reservations are released
      // explicitly by DELETE /api/uploads/commit when a transfer fails, and
      // swept within the hour otherwise, so nobody is held out for long.
      transaction.portfolioAsset.aggregate({
        where: { userId, status: { in: ["ready", "pending"] } },
        _sum: { bytes: true },
      }),
      transaction.portfolioAsset.count({ where: { userId, kind, status: { in: ["ready", "pending"] } } }),
    ]);

    const usedBytes = used._sum.bytes || 0;
    if (usedBytes + size > PORTFOLIO_STORAGE_QUOTA_BYTES) {
      return {
        ok: false as const,
        status: 409,
        message: `This upload would pass your ${megabytes(PORTFOLIO_STORAGE_QUOTA_BYTES)} MB storage limit. Remove some files, or use an embed, which uses no storage.`,
      };
    }
    if (kindCount >= limit.perPortfolio) {
      return {
        ok: false as const,
        status: 409,
        message: `You can upload up to ${limit.perPortfolio} ${limit.label} files. Embedded ${limit.label} does not count toward this.`,
      };
    }

    await transaction.portfolioAsset.create({
      data: { userId, key, kind, contentType, bytes: size, status: "pending" },
    });
    return { ok: true as const };
  });
}

export async function POST(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const requestedKind = body?.kind;
  if (requestedKind !== undefined && !isPortfolioAssetKind(requestedKind)) {
    return NextResponse.json({ message: "Choose a supported media type." }, { status: 400 });
  }
  const kind: PortfolioAssetKind | null = requestedKind === undefined ? null : requestedKind;

  // Local development origins are not in the asset bucket's CORS allowlist, so
  // a browser PUT to S3 would be rejected with a network-level "Failed to
  // fetch". Fall back to inline image data there (the existing 503 path) so
  // local uploads keep working without widening the bucket's CORS origins.
  const origin = request.headers.get("origin") || "";
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    if (kind && kind !== "image") {
      return NextResponse.json(
        { message: "Video, audio, and documents need object storage, which is not available locally. Use an embed to preview this locally." },
        { status: 503, headers: { "X-Upload-Fallback": "unavailable" } },
      );
    }
    return NextResponse.json({ message: "Local development uses inline image data." }, { status: 503 });
  }
  if (!await durableRateLimit(`asset-presign:${session.userId}:${getRequestIp(request)}`, 60, 15 * 60 * 1000)) {
    return NextResponse.json({ message: "Too many upload attempts. Please wait and try again." }, { status: 429 });
  }

  const bucket = process.env.ASSET_BUCKET;
  const region = process.env.AWS_REGION;
  if (!bucket || !region) {
    return NextResponse.json(
      { message: "Object storage is not configured in this environment." },
      { status: 503 },
    );
  }

  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const size = Number(body?.size);
  const purpose = body?.purpose === "portfolio" ? "portfolio" : null;

  if (!kind) {
    const extension = legacyImageTypes.get(contentType);
    const configuredMax = Number(process.env.MAX_UPLOAD_BYTES);
    const maxBytes = Number.isSafeInteger(configuredMax) && configuredMax > 0
      ? configuredMax
      : 10 * 1024 * 1024;

    if (!purpose || !extension || !Number.isSafeInteger(size) || size <= 0 || size > maxBytes) {
      return NextResponse.json(
        { message: `Use a supported image no larger than ${megabytes(maxBytes)} MB.` },
        { status: 400 },
      );
    }
    // The per-account quota applies here too. This branch is what every
    // existing image caller uses, so skipping it left the cap unenforced for
    // the majority of uploads.
    return await issueUpload({ bucket, region, userId: session.userId, purpose, extension, contentType, size, kind: "image" });
  }

  const limit = PORTFOLIO_MEDIA_LIMITS[kind];
  const extension = limit.types[contentType];
  // The per-format cap is tunable in code; the environment sets a hard ceiling
  // no format may exceed, so a bad constant cannot blow up the storage bill.
  const configuredCeiling = Number(process.env.MAX_MEDIA_UPLOAD_BYTES);
  const ceiling = Number.isSafeInteger(configuredCeiling) && configuredCeiling > 0 ? configuredCeiling : 150 * 1024 * 1024;
  const maxBytes = Math.min(maxBytesFor(kind, contentType), ceiling);

  if (!purpose || !Number.isSafeInteger(size) || size <= 0) {
    return NextResponse.json({ message: "That upload could not be prepared." }, { status: 400 });
  }
  if (!extension) {
    const formats = Array.from(new Set(Object.values(limit.types))).join(", ");
    return NextResponse.json(
      { message: `Use a supported ${limit.label} format: ${formats}.` },
      { status: 400 },
    );
  }
  if (size > maxBytes) {
    return NextResponse.json(
      { message: `Keep ${limit.label} files under ${megabytes(maxBytes)} MB. For anything longer or larger, paste a link from a hosting platform instead.` },
      { status: 400 },
    );
  }

  return await issueUpload({ bucket, region, userId: session.userId, purpose, extension, contentType, size, kind });
}

async function issueUpload({
  bucket, region, userId, purpose, extension, contentType, size, kind,
}: {
  bucket: string;
  region: string;
  userId: string;
  purpose: string;
  extension: string;
  contentType: string;
  size: number;
  kind: PortfolioAssetKind;
}) {
  const key = `${purpose}/${userId}/${crypto.randomUUID()}.${extension}`;

  // Reserve before signing: a refused request must never hand back a usable
  // upload URL. Signing is stateless, so doing it after costs nothing.
  const reservation = await reserveAssetSlot({ userId, kind, size, contentType, key });
  if (!reservation.ok) {
    return NextResponse.json({ message: reservation.message }, { status: reservation.status });
  }

  // `WHEN_SUPPORTED` is the SDK default, and for a presigned PUT it is wrong:
  // the command carries no Body, so the SDK computes CRC32 over zero bytes and
  // hoists `x-amz-checksum-crc32` into the query string. Storage then compares
  // the real body against the checksum of an empty one and rejects every
  // upload. Nothing local catches this — localhost short-circuits to the
  // inline fallback above, so it only ever fails in a deployed environment.
  const client = new S3Client({ region, requestChecksumCalculation: "WHEN_REQUIRED" });
  // Signing ContentLength binds the declared size: storage rejects a body that
  // does not match, so the size checked above is the size that can be written.
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: {
        owner: userId,
        purpose,
      },
    }),
    { expiresIn: 300 },
  );

  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return NextResponse.json({
    uploadUrl,
    assetUrl: `/api/public/assets/${encodedKey}`,
    key,
    headers: { "Content-Type": contentType },
  });
}
