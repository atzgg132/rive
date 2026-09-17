import { NextRequest, NextResponse } from "next/server";
import { googleCalendarAvailable } from "@/utils/connectorConfig";
import { CALENDAR_SYNC_DEADLINE_MS, processCalendarSyncOutbox } from "@/utils/calendarOutbox";

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  if (!googleCalendarAvailable()) {
    return NextResponse.json({ success: true, disabled: true, claimed: 0, processed: 0, completed: 0, skipped: 0, retried: 0, failed: 0, reclaimed: 0 });
  }
  // The deadline stops new claims before the job runner's 25s HTTP timeout can
  // strand a row in "processing".
  const result = await processCalendarSyncOutbox({ deadlineMs: CALENDAR_SYNC_DEADLINE_MS });
  return NextResponse.json({
    success: true,
    claimed: result.claimed,
    // Jobs resolved this run: the push landed, or there was provably nothing
    // left to push. Retried and failed rows are reported separately.
    processed: result.completed + result.skipped,
    completed: result.completed,
    skipped: result.skipped,
    retried: result.retried,
    failed: result.failed,
    reclaimed: result.reclaimed,
  });
}
