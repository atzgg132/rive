import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { migrationEngineAvailable } from "@/utils/migration/config";
import { commitMigration } from "@/utils/migration/commit";
import { ensureDefaultCalendar } from "@/utils/calendar";
import { ensurePrefilledPortfolio } from "@/utils/portfolioProvisioning";
import { ACTIVATION_EVENTS, recordActivationEvent } from "@/utils/activation";

/**
 * Commit a reviewed migration.
 *
 * The client must send the plan hash it was shown. That is the entire
 * safeguard against previewing one result and importing another: if the hash
 * no longer matches, the commit is refused and the user is sent back to look.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  if (!migrationEngineAvailable()) {
    return NextResponse.json({ success: false, message: "Migration is not available yet." }, { status: 404 });
  }
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!rateLimit(`migration-commit:${session.userId}:${getRequestIp(req)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many import attempts. Try again later." }, { status: 429 });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => null);
  const planHash = typeof (body as { planHash?: unknown })?.planHash === "string"
    ? String((body as { planHash: string }).planHash)
    : "";
  if (!planHash) {
    return NextResponse.json({ success: false, message: "Review the import summary before importing." }, { status: 400 });
  }

  const outcome = await commitMigration(session.userId, id, planHash);

  if (outcome.status === "conflict") {
    return NextResponse.json({ success: false, ...outcome }, { status: 409 });
  }
  if (outcome.status === "failed") {
    // A partial import is reported truthfully, with counts, rather than as an
    // opaque server error. The ledger already records exactly where it stopped.
    return NextResponse.json({ success: false, ...outcome }, { status: 500 });
  }

  const total = outcome.created.clients + outcome.created.projects + outcome.created.invoices + outcome.created.expenses;

  if (total > 0) {
    // Imported data is real business context, so the workspace is provisioned
    // and activation advanced exactly as it would be for hand-entered records.
    await Promise.all([
      ensureDefaultCalendar(session.userId),
      ensurePrefilledPortfolio(session.userId),
      prisma.user.updateMany({
        where: { id: session.userId, onboardingStatus: { not: "complete" } },
        data: { onboardingStatus: "complete", onboardingStep: 5 },
      }),
    ]);
    if (outcome.created.clients > 0) {
      await recordActivationEvent(session.userId, ACTIVATION_EVENTS.firstClientCreated, { source: "migration" });
    }
    if (outcome.created.projects > 0) {
      await recordActivationEvent(session.userId, ACTIVATION_EVENTS.firstProjectCreated, { source: "migration" });
    }
    if (outcome.created.invoices > 0 || outcome.created.expenses > 0) {
      await recordActivationEvent(session.userId, ACTIVATION_EVENTS.firstMeaningfulWorkflowCompleted, { source: "migration" });
    }
  }

  return NextResponse.json({ success: true, ...outcome, total });
}
