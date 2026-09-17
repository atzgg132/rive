import { NextRequest, NextResponse } from "next/server";
import { collectEmailOutboxMetrics, processEmailOutbox, CRON_PROCESSING_DEADLINE_MS } from "@/utils/emailOutbox";
import { refreshOverdueInvoices } from "@/utils/invoiceLifecycle";
import { logger, logMetric, requestLogContext } from "@/utils/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  const context = requestLogContext(req);
  try {
    const [result, overdueUpdated] = await Promise.all([
      processEmailOutbox({ limit: 8, deadlineMs: CRON_PROCESSING_DEADLINE_MS }),
      refreshOverdueInvoices(),
    ]);
    const metrics = await collectEmailOutboxMetrics().catch((error) => {
      logger.warn("email_outbox_metrics_failed", { ...context, error });
      return null;
    });
    if (metrics) {
      logMetric("email_outbox_oldest_queued_seconds", metrics.oldestQueuedSeconds, context);
      logMetric("email_outbox_terminal_failures_last_hour", metrics.terminalFailuresLastHour, context);
      logMetric("email_outbox_processing_count", metrics.processingCount, context);
    }
    return NextResponse.json({ success: true, overdueUpdated, ...result });
  } catch (error) {
    logger.error("email_outbox_cron_failed", { ...context, error });
    return NextResponse.json({ success: false, message: "Email outbox processing failed." }, { status: 500 });
  }
}
