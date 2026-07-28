import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

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
  const key = segments.map(decodeURIComponent).join("/");
  if (!/^portfolio\/[0-9a-f-]+\/[0-9a-f-]+\.(?:jpg|png|webp|gif)$/i.test(key)) {
    return NextResponse.json({ message: "Asset not found." }, { status: 404 });
  }

  try {
    const result = await new S3Client({ region }).send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (!result.Body) throw new Error("Asset has no body.");

    return new NextResponse(result.Body.transformToWebStream(), {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Content-Type": result.ContentType || "application/octet-stream",
        "Content-Length": String(result.ContentLength || ""),
        ETag: result.ETag || "",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Asset delivery failed:", error);
    return NextResponse.json({ message: "Asset not found." }, { status: 404 });
  }
}
