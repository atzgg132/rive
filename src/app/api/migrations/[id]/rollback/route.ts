import { NextRequest, NextResponse } from "next/server";
import { migrationEngineAvailable } from "@/utils/migration/config";

/**
 * Historical compatibility route. Imported records are never removed.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  void req;
  void context;
  if (!migrationEngineAvailable()) return NextResponse.json({ success: false, message: "Migration is not available yet." }, { status: 404 });
  return NextResponse.json({ success: false, message: "Migration rollback is disabled. Imported records are never removed." }, { status: 410 });
}

export async function POST(req: NextRequest, context: RouteContext) {
  void req;
  void context;
  if (!migrationEngineAvailable()) return NextResponse.json({ success: false, message: "Migration is not available yet." }, { status: 404 });
  return NextResponse.json({ success: false, message: "Migration rollback is disabled. Imported records are never removed." }, { status: 410 });
}
