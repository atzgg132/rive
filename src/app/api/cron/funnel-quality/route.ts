import { NextRequest, NextResponse } from "next/server";
import { getAdminMetrics } from "@/utils/adminMetrics";

export const dynamic = "force-dynamic";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`funnel quality check timed out after ${timeoutMs}ms`)), timeoutMs);
      timer.unref?.();
    }),
  ]);
}

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const metrics = await withTimeout(getAdminMetrics(true), 20_000);
    const alerts = metrics.quality.alerts;
    const criticalCount = alerts.filter((item) => item.severity === "critical").length;
    const warningCount = alerts.filter((item) => item.severity === "warning").length;
    const payload = {
      success: true,
      healthy: alerts.length === 0,
      checkedAt: new Date().toISOString(),
      generatedAt: metrics.generatedAt,
      definitionVersion: metrics.definitionVersion,
      schemaVersion: metrics.quality.schemaVersion,
      criticalCount,
      warningCount,
      alerts,
    };

    if (criticalCount > 0) {
      console.error("[funnel-quality] critical threshold breach", JSON.stringify(payload));
      return NextResponse.json(payload, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    if (warningCount > 0) console.warn("[funnel-quality] warning threshold breach", JSON.stringify(payload));
    else console.info("[funnel-quality] healthy", JSON.stringify(payload));
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[funnel-quality] check failed", error);
    return NextResponse.json({ success: false, message: "Funnel quality check failed." }, { status: 500 });
  }
}
