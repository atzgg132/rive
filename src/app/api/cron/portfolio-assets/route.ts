import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { MANAGED_ASSET_KEY } from "@/utils/portfolioMedia";

export const dynamic = "force-dynamic";

/* Uploads that were never confirmed are abandoned attempts. Confirmed uploads
   are given a grace period so an asset removed from a draft can be restored by
   an undo or a conflict reload before its bytes go away.

   The abandoned window is deliberately short and the job runs hourly: a pending
   row counts against its owner's quota for as long as it exists, so a long
   window would both hold honest users out of their own space and leave a gap
   in which uploaded-but-unconfirmed bytes accumulate uncharged. The browser
   releases failed transfers itself; this is the backstop for callers that
   disappear mid-upload. It must stay comfortably longer than the presigned
   URL's own 300s lifetime so an in-flight transfer is never swept. */
const ABANDONED_UPLOAD_HOURS = 1;
const UNREFERENCED_GRACE_DAYS = 7;
const BATCH = 500;
/* Analytics only ever reads the last 30 days, but every public visit writes a
   row forever. Keeping a wider window than the dashboard shows leaves room to
   widen the reports later without the table growing without bound. */
const VIEW_RETENTION_DAYS = 120;

/** Every managed asset key the given values still point at.
 *
 *  Takes a list rather than just the portfolio because an asset key can be
 *  referenced from more than one place. `User.avatarUrl` is the other one: an
 *  avatar uploaded during onboarding is only mirrored into portfolio content
 *  once a portfolio row exists, so scanning content alone deleted the avatar of
 *  anyone who uploaded one and had not yet finished onboarding. */
function referencedKeys(...values: unknown[]): Set<string> {
  const keys = new Set<string>();
  const search = /\/api\/public\/assets\/(portfolio\/[0-9a-f-]+\/[0-9a-f-]+\.[a-z0-9]+)/gi;
  for (const value of values) {
    for (const match of JSON.stringify(value ?? {}).matchAll(search)) {
      const key = match[1];
      if (MANAGED_ASSET_KEY.test(key)) keys.add(key);
    }
  }
  return keys;
}

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const bucket = process.env.ASSET_BUCKET;
  const region = process.env.AWS_REGION;
  if (!bucket || !region) {
    return NextResponse.json({ success: false, message: "Object storage is not configured." }, { status: 503 });
  }

  const now = Date.now();
  const abandonedBefore = new Date(now - ABANDONED_UPLOAD_HOURS * 60 * 60 * 1000);
  const unreferencedBefore = new Date(now - UNREFERENCED_GRACE_DAYS * 24 * 60 * 60 * 1000);

  try {
    const abandoned = await prisma.portfolioAsset.findMany({
      where: { status: "pending", createdAt: { lt: abandonedBefore } },
      select: { key: true },
      take: BATCH,
    });

    const candidates = await prisma.portfolioAsset.findMany({
      where: { status: "ready", createdAt: { lt: unreferencedBefore } },
      select: { key: true, userId: true },
      take: BATCH,
    });

    const unreferenced: string[] = [];
    const byUser = new Map<string, string[]>();
    for (const asset of candidates) {
      byUser.set(asset.userId, [...(byUser.get(asset.userId) || []), asset.key]);
    }
    for (const [userId, keys] of byUser) {
      // One portfolio per user, so this stays a single lookup per owner. The
      // user row is read alongside it because the avatar is a second, separate
      // place a managed key can live.
      const [portfolio, user] = await Promise.all([
        prisma.portfolio.findUnique({ where: { userId }, select: { content: true } }),
        prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } }),
      ]);
      const referenced = referencedKeys(portfolio?.content, user?.avatarUrl);
      for (const key of keys) {
        if (!referenced.has(key)) unreferenced.push(key);
      }
    }

    const prunedViews = await prisma.portfolioView.deleteMany({
      where: { viewedAt: { lt: new Date(now - VIEW_RETENTION_DAYS * 24 * 60 * 60 * 1000) } },
    });

    const removable = [...abandoned.map((asset) => asset.key), ...unreferenced];
    if (removable.length === 0) {
      return NextResponse.json(
        { success: true, deleted: 0, abandoned: 0, unreferenced: 0, prunedViews: prunedViews.count },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const client = new S3Client({ region });
    // DeleteObjects caps at 1000 keys per call; BATCH keeps each pass under it.
    for (let index = 0; index < removable.length; index += 1000) {
      await client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: removable.slice(index, index + 1000).map((key) => ({ Key: key })), Quiet: true },
      }));
    }
    const { count } = await prisma.portfolioAsset.deleteMany({ where: { key: { in: removable } } });

    console.info("[portfolio-assets] swept", JSON.stringify({
      abandoned: abandoned.length,
      unreferenced: unreferenced.length,
      deleted: count,
      prunedViews: prunedViews.count,
    }));
    return NextResponse.json(
      { success: true, deleted: count, abandoned: abandoned.length, unreferenced: unreferenced.length, prunedViews: prunedViews.count },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[portfolio-assets] sweep failed", error);
    return NextResponse.json({ success: false, message: "Portfolio asset sweep failed." }, { status: 500 });
  }
}
