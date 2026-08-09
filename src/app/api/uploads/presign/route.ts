import crypto from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export async function POST(request: NextRequest) {
  const session = getSessionUser(request);
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }
  if (!rateLimit(`asset-presign:${session.userId}:${getRequestIp(request)}`, 60, 15 * 60 * 1000)) {
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

  const body = await request.json().catch(() => null);
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const size = Number(body?.size);
  const purpose = body?.purpose === "portfolio" ? "portfolio" : null;
  const extension = allowedTypes.get(contentType);
  const configuredMax = Number(process.env.MAX_UPLOAD_BYTES);
  const maxBytes = Number.isSafeInteger(configuredMax) && configuredMax > 0
    ? configuredMax
    : 10 * 1024 * 1024;

  if (!purpose || !extension || !Number.isSafeInteger(size) || size <= 0 || size > maxBytes) {
    return NextResponse.json(
      { message: `Use a supported image no larger than ${Math.floor(maxBytes / 1024 / 1024)} MB.` },
      { status: 400 },
    );
  }

  const key = `${purpose}/${session.userId}/${crypto.randomUUID()}.${extension}`;
  const client = new S3Client({ region });
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: {
        owner: session.userId,
        purpose,
      },
    }),
    { expiresIn: 300 },
  );

  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return NextResponse.json({
    uploadUrl,
    assetUrl: `/api/public/assets/${encodedKey}`,
    headers: { "Content-Type": contentType },
  });
}
