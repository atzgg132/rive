import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { isPortfolioPublished } from "@/utils/portfolio";
import {
  MANAGED_ASSET_KEY,
  extensionContentType,
  extensionKind,
  isProxiedAssetKind,
  keyExtension,
  assetOwnerId,
} from "@/utils/portfolioMedia";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
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

  /* Unpublishing must actually unpublish. Without this, every cover and file
     stayed reachable by its URL forever: unpublishing hid the page but not
     the bytes. The owner still previews drafts — the studio and
     /portfolio-preview send the session cookie — but anyone else only sees
     assets of a published portfolio. Pending uploads are unguessable UUIDs
     known only to the uploader, so the published check is the whole gate.
     Every refusal below keeps the same 404 shape so it never reveals whether
     the key exists. */
  const ownerId = assetOwnerId(key);
  const session = await getSessionUser(request).catch(() => null);
  /* Success responses vary by cookie (owner preview vs public), so only
     published portfolios are shared-cacheable. Owner-only draft views stay
     private no matter what. */
  let published = false;
  if (!ownerId || session?.userId !== ownerId) {
    const portfolio = ownerId
      ? await prisma.portfolio.findUnique({ where: { userId: ownerId }, select: { status: true } }).catch(() => null)
      : null;
    published = Boolean(portfolio && isPortfolioPublished(portfolio.status));
    if (!published) {
      return NextResponse.json({ message: "Asset not found." }, { status: 404 });
    }
  }

  const client = new S3Client({ region });

  /* Video, audio, and documents are redirected rather than proxied. Streaming
     them through the app would mean no range requests — so no seeking, and a
     player that stalls in browsers that require a 206 — while every byte also
     consumed an application connection. Draft previews get a short-lived
     signature instead, and their responses are never shared-cacheable —
     see the gate above. Published media keeps the long-lived public caching. */
  if (!isProxiedAssetKind(kind)) {
    try {
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseContentType: contentType,
          ResponseContentDisposition: "inline",
          ResponseCacheControl: published
            ? "public, max-age=86400, stale-while-revalidate=604800"
            : "private, no-store",
        }),
        // Kept at twice the redirect's cache lifetime. A cache that drops
        // Age headers can serve a stored 302 for its full max-age again, so a
        // signature that merely outlives one window is not enough.
        /* Draft previews get a short signature: just long enough to load. */
        { expiresIn: published ? 1800 : 60 },
      );
      return NextResponse.redirect(url, {
        status: 302,
        headers: {
          "Cache-Control": published ? "public, max-age=600" : "private, no-store",
          "Vary": "Cookie",
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
      "Cache-Control": published ? "public, max-age=86400, stale-while-revalidate=604800" : "private, no-store",
      "Vary": "Cookie",
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
