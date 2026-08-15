import { NextRequest, NextResponse } from "next/server";
import { processEmailOutbox } from "@/utils/emailOutbox";
import { refreshOverdueInvoices } from "@/utils/invoiceLifecycle";

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  try {
    const [result, overdueUpdated] = await Promise.all([processEmailOutbox(25), refreshOverdueInvoices()]);
    return NextResponse.json({ success: true, overdueUpdated, ...result });
  } catch (error) {
    console.error("Email outbox cron failed:", error);
    return NextResponse.json({ success: false, message: "Email outbox processing failed." }, { status: 500 });
  }
}
