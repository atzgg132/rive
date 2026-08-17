import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import {
  MANAGED_ASSET_KEY,
  extensionContentType,
  extensionKind,
  isProxiedAssetKind,
  keyExtension,
} from "@/utils/portfolioMedia";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ key: string[] }> },
) {
  const bucket = process.env.ASSET_BUCKET;
  const region = process.env.AWS_REGION;
  if (!bucket || !region) {
    return NextResponse.json({ message: "Asset storage is unavailable." }, { status: 503 });
  }

  const { key: segments } = await context.params;
  let key: string;
  try {
    key = segments.map(decodeURIComponent).join("/");
  } catch {
    return NextResponse.json({ message: "Asset not found." }, { status: 404 });
  }
  if (!MANAGED_ASSET_KEY.test(key)) {
    return NextResponse.json({ message: "Asset not found." }, { status: 404 });
  }

  const extension = keyExtension(key);
  const kind = extensionKind(extension);
  const contentType = extensionContentType(extension);
  if (!kind || !contentType) {
    return NextResponse.json({ message: "Asset not found." }, { status: 404 });
  }

  const client = new S3Client({ region });

  /* Video, audio, and documents are redirected rather than proxied. Streaming
     them through the app would mean no range requests — so no seeking, and a
     player that stalls in browsers that require a 206 — while every byte also
     consumed an application connection. The signed URL is short-lived and only
     ever points at media already published on a public portfolio. */
  if (!isProxiedAssetKind(kind)) {
    try {
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseContentType: contentType,
          ResponseContentDisposition: "inline",
          ResponseCacheControl: "public, max-age=86400, stale-while-revalidate=604800",
        }),
        // Kept at twice the redirect's cache lifetime. A cache that drops
        // Age headers can serve a stored 302 for its full max-age again, so a
        // signature that merely outlives one window is not enough.
        { expiresIn: 1800 },
      );
      return NextResponse.redirect(url, {
        status: 302,
        headers: {
          "Cache-Control": "public, max-age=600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      console.error("Asset redirect failed:", error);
      return NextResponse.json({ message: "Asset not found." }, { status: 404 });
    }
  }

  try {
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!result.Body) throw new Error("Asset has no body.");

    // Only send Content-Length and ETag when storage actually reported them.
    // Emitting an empty value for either is not a valid header and upsets
    // intermediaries; a chunked response without them is well-defined.
    const headers = new Headers({
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Type": contentType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    });
    if (typeof result.ContentLength === "number") headers.set("Content-Length", String(result.ContentLength));
    if (result.ETag) headers.set("ETag", result.ETag);

    return new NextResponse(result.Body.transformToWebStream(), { headers });
  } catch (error) {
    console.error("Asset delivery failed:", error);
    return NextResponse.json({ message: "Asset not found." }, { status: 404 });
  }
}
