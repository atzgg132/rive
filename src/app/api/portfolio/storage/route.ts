import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { PORTFOLIO_MEDIA_LIMITS, PORTFOLIO_STORAGE_QUOTA_BYTES, isPortfolioAssetKind } from "@/utils/portfolioMedia";

export const dynamic = "force-dynamic";

/** What the owner is actually using, so the quota is visible before it bites. */
export async function GET(request: NextRequest) {
  const session = await getSessionUser(request);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    /* Counts pending alongside ready, because that is what the quota check in
       the presign route enforces. Reporting only confirmed assets meant the
       figure shown here could sit well under the cap while an upload was
       refused for passing it, with nothing on screen to explain the gap. */
    const grouped = await prisma.portfolioAsset.groupBy({
      by: ["kind"],
      where: { userId: session.userId, status: { in: ["ready", "pending"] } },
      _sum: { bytes: true },
      _count: { _all: true },
    });

    const byKind = grouped.map((row) => ({
      kind: row.kind,
      bytes: row._sum.bytes || 0,
      count: row._count._all,
      maxCount: isPortfolioAssetKind(row.kind) ? PORTFOLIO_MEDIA_LIMITS[row.kind].perPortfolio : null,
    }));
    const usedBytes = byKind.reduce((total, row) => total + row.bytes, 0);

    return NextResponse.json({
      success: true,
      storage: {
        usedBytes,
        quotaBytes: PORTFOLIO_STORAGE_QUOTA_BYTES,
        percentUsed: Math.min(Math.round((usedBytes / PORTFOLIO_STORAGE_QUOTA_BYTES) * 100), 100),
        byKind,
      },
    });
  } catch (error) {
    console.error("Portfolio storage usage error:", error);
    return NextResponse.json({ success: false, message: "Could not load storage usage." }, { status: 500 });
  }
}
