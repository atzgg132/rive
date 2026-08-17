import { DeleteObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp } from "@/utils/rateLimit";
import { durableRateLimit } from "@/utils/durableRateLimit";
import {
  CONTENT_SIGNATURE_BYTES,
  MANAGED_ASSET_KEY,
  keyExtension,
  matchesContentSignature,
} from "@/utils/portfolioMedia";

/**
 * Confirm an upload before it becomes usable.
 *
 * The browser writes directly to object storage, so the declared content type
 * is only its claim. This reads the first few bytes back and checks them
 * against the format's signature. Anything that does not match is deleted
 * rather than left addressable, which is what stops a renamed executable or an
 * HTML file from being served from the assets path.
 */
export async function POST(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  if (!await durableRateLimit(`asset-commit:${session.userId}:${getRequestIp(request)}`, 60, 15 * 60 * 1000)) {
    return NextResponse.json({ message: "Too many upload attempts. Please wait and try again." }, { status: 429 });
  }

  const bucket = process.env.ASSET_BUCKET;
  const region = process.env.AWS_REGION;
  if (!bucket || !region) {
    return NextResponse.json({ message: "Object storage is not configured in this environment." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key : "";
  if (!key || !MANAGED_ASSET_KEY.test(key)) {
    return NextResponse.json({ message: "That upload could not be confirmed." }, { status: 400 });
  }

  const asset = await prisma.portfolioAsset.findUnique({ where: { key } });
  if (!asset || asset.userId !== session.userId) {
    return NextResponse.json({ message: "That upload could not be confirmed." }, { status: 404 });
  }
  if (asset.status === "ready") {
    return NextResponse.json({ success: true, assetUrl: assetUrlFor(key), kind: asset.kind });
  }

  const client = new S3Client({ region });
  let header: Uint8Array;
  try {
    const result = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: `bytes=0-${CONTENT_SIGNATURE_BYTES - 1}`,
    }));
    if (!result.Body) throw new Error("Uploaded object has no body.");
    header = await result.Body.transformToByteArray();
  } catch (error) {
    console.error("Asset confirmation read failed:", error);
    return NextResponse.json({ message: "The upload did not finish. Try again." }, { status: 409 });
  }

  if (!matchesContentSignature(keyExtension(key), header)) {
    await Promise.all([
      client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined),
      prisma.portfolioAsset.delete({ where: { key } }).catch(() => undefined),
    ]);
    return NextResponse.json(
      { message: "That file's contents do not match its format. Re-export it and try again." },
      { status: 400 },
    );
  }

  await prisma.portfolioAsset.update({
    where: { key },
    data: { status: "ready", confirmedAt: new Date() },
  });

  return NextResponse.json({ success: true, assetUrl: assetUrlFor(key), kind: asset.kind });
}

/**
 * Release a reservation whose transfer did not finish.
 *
 * Pending rows count against the quota for as long as they exist, because the
 * bytes may really be in storage. Without a way to give one back, a dropped
 * connection would hold that space until the sweeper ran. The browser calls
 * this when its PUT fails, which turns the common case into an immediate
 * release and leaves the sweeper as the backstop for callers that vanish.
 *
 * Deleting the object is best-effort: the upload may never have landed, and a
 * missing key is the expected case rather than an error.
 */
export async function DELETE(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key : "";
  if (!key || !MANAGED_ASSET_KEY.test(key)) {
    return NextResponse.json({ message: "That upload could not be released." }, { status: 400 });
  }

  // Scoped by userId as well as key so one account can never release another's
  // reservation, and restricted to `pending` so a confirmed asset that is in
  // use cannot be deleted through the abandon path.
  const { count } = await prisma.portfolioAsset.deleteMany({
    where: { key, userId: session.userId, status: "pending" },
  });
  if (count === 0) return NextResponse.json({ message: "That upload could not be released." }, { status: 404 });

  const bucket = process.env.ASSET_BUCKET;
  const region = process.env.AWS_REGION;
  if (bucket && region) {
    await new S3Client({ region })
      .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      .catch(() => undefined);
  }

  return NextResponse.json({ success: true });
}

function assetUrlFor(key: string): string {
  return `/api/public/assets/${key.split("/").map(encodeURIComponent).join("/")}`;
}
