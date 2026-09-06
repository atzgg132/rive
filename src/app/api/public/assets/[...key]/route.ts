import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getPublicPortfolioContent, isPortfolioPublished } from "@/utils/portfolio";
import {
  MANAGED_ASSET_KEY,
  extensionContentType,
  extensionKind,
  keyExtension,
  assetOwnerId,
} from "@/utils/portfolioMedia";

export const dynamic = "force-dynamic";

function assetUrlForKey(key: string): string {
  return `/api/public/assets/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Public object access follows the same intentional-visibility projection as
 * the rendered portfolio. A published status alone is not enough: an owner
 * can remove a media row while keeping the portfolio published, and that must
 * unpublish the bytes too. Private source images and arbitrary stored fields
 * never become public merely because they contain a managed-looking URL.
 */
function isPublicAssetReference(content: unknown, key: string): boolean {
  const publicContent = getPublicPortfolioContent(content);
  const assetUrl = assetUrlForKey(key);
  if (publicContent.profileImageUrl === assetUrl) return true;
  return publicContent.projects.some((project) => (
    project.imageUrl === assetUrl
    || project.gallery?.some((image) => image.url === assetUrl)
    || project.media?.some((media) => media.url === assetUrl || media.posterUrl === assetUrl)
  ));
}

function parseRangeHeader(value: string | null): string | null | false {
  if (!value) return null;
  const normalized = value.trim();
  const match = /^bytes=(\d*)-(\d*)$/.exec(normalized);
  if (!match || (!match[1] && !match[2])) return false;
  if (match[1] && match[2] && BigInt(match[1]) > BigInt(match[2])) return false;
  if (!match[1] && match[2] === "0") return false;
  return normalized;
}

function rangeNotSatisfiableResponse() {
  return new NextResponse(null, {
    status: 416,
    headers: { "Accept-Ranges": "bytes" },
  });
}

function isRangeNotSatisfiable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: string; Code?: string; code?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.$metadata?.httpStatusCode === 416
    || candidate.name === "InvalidRange"
    || candidate.Code === "InvalidRange"
    || candidate.code === "InvalidRange";
}

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

  /* Unpublishing — or removing a reference while published — must actually
     unpublish the bytes. The owner still previews drafts (the studio sends
     the session cookie), but anyone else needs both a published portfolio
     AND a live reference in its public content. UUID secrecy is not an
     authorization boundary. Every refusal keeps the same 404 shape so it
     never reveals whether the key exists, and every refusal happens before
     any storage read. */
  const ownerId = assetOwnerId(key);
  const session = await getSessionUser(request).catch(() => null);
  if (!ownerId || session?.userId !== ownerId) {
    const portfolio = ownerId
      ? await prisma.portfolio.findUnique({ where: { userId: ownerId }, select: { status: true, content: true } }).catch((error) => {
          console.error("Asset portfolio lookup failed:", error);
          return null;
        })
      : null;
    const published = Boolean(portfolio && isPortfolioPublished(portfolio.status));
    if (!published || !isPublicAssetReference(portfolio?.content, key)) {
      return NextResponse.json({ message: "Asset not found." }, { status: 404 });
    }
  }

  const range = parseRangeHeader(request.headers.get("range"));
  if (range === false) return rangeNotSatisfiableResponse();

  const client = new S3Client({ region });

  try {
    const result = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(range ? { Range: range } : {}),
    }));
    if (!result.Body) throw new Error("Asset has no body.");

    /* Every byte streams through the app with `private, no-store` so that
       unpublishing or removing a reference takes effect on the very next
       request — no browser or CDN copy can keep serving revoked bytes, and no
       signed-URL lifetime outlives the reference. See the delivery report for
       the caching/egress cost this trades away. */
    // Only send Content-Length and ETag when storage actually reported them.
    // Emitting an empty value for either is not a valid header and upsets
    // intermediaries; a chunked response without them is well-defined.
    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "Vary": "Cookie",
      "Content-Type": contentType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": result.AcceptRanges || "bytes",
    });
    if (range && result.ContentRange) headers.set("Content-Range", result.ContentRange);
    if (typeof result.ContentLength === "number") headers.set("Content-Length", String(result.ContentLength));
    if (result.ETag) headers.set("ETag", result.ETag);

    return new NextResponse(result.Body.transformToWebStream(), { status: range ? 206 : 200, headers });
  } catch (error) {
    if (range && isRangeNotSatisfiable(error)) return rangeNotSatisfiableResponse();
    console.error("Asset delivery failed:", error);
    return NextResponse.json({ message: "Asset not found." }, { status: 404 });
  }
}
