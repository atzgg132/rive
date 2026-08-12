import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { migrationEngineAvailable } from "@/utils/migration/config";
import { executeRollback, previewRollback } from "@/utils/migration/rollback";

/**
 * Undo a migration.
 *
 * `GET` reports exactly what would be removed and what would be kept, so the
 * confirmation the user sees is the truth rather than an estimate. `POST`
 * performs it.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  if (!migrationEngineAvailable()) {
    return NextResponse.json({ success: false, message: "Migration is not available yet." }, { status: 404 });
  }
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const { id } = await context.params;
  const preview = await previewRollback(session.userId, id);
  return NextResponse.json({ success: preview.ok, ...preview }, { status: preview.ok ? 200 : 409 });
}

export async function POST(req: NextRequest, context: RouteContext) {
  if (!migrationEngineAvailable()) {
    return NextResponse.json({ success: false, message: "Migration is not available yet." }, { status: 404 });
  }
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!rateLimit(`migration-rollback:${session.userId}:${getRequestIp(req)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many undo attempts. Try again later." }, { status: 429 });
  }

  const { id } = await context.params;
  const outcome = await executeRollback(session.userId, id);
  return NextResponse.json({ success: outcome.ok, ...outcome }, { status: outcome.ok ? 200 : 409 });
}
