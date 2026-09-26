import { NextRequest, NextResponse } from "next/server";
import { collectEmailOutboxMetrics, processEmailOutbox, CRON_PROCESSING_DEADLINE_MS } from "@/utils/emailOutbox";
import { refreshOverdueInvoices } from "@/utils/invoiceLifecycle";
import { sendDueInvoiceReminders } from "@/utils/invoiceReminders";
import { logger, logMetric, requestLogContext } from "@/utils/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  const context = requestLogContext(req);
  try {
    const overdueUpdated = await refreshOverdueInvoices();
    const [result, reminders] = await Promise.all([
      processEmailOutbox({ limit: 8, deadlineMs: CRON_PROCESSING_DEADLINE_MS }),
      // Runs after the overdue refresh commits so a status flip this tick is
      // visible to reminder eligibility right away instead of next run.
      sendDueInvoiceReminders().catch((error) => {
        logger.error("invoice_reminders_failed", { ...context, error });
        return { sent: 0, skipped: 0, considered: 0 };
      }),
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
    logMetric("invoice_reminders_sent", reminders.sent, context);
    return NextResponse.json({ success: true, overdueUpdated, reminders, ...result });
  } catch (error) {
    logger.error("email_outbox_cron_failed", { ...context, error });
    return NextResponse.json({ success: false, message: "Email outbox processing failed." }, { status: 500 });
  }
}
