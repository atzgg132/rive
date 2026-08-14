import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utils/db";
import { getSessionUser } from "@/utils/userAuth";
import { getRequestIp, rateLimit } from "@/utils/rateLimit";
import { zohoBooksAvailable } from "@/utils/connectorConfig";
import { decryptCalendarCredentials } from "@/utils/calendarCrypto";
import { createZohoProvider, type ZohoRecord } from "@/lib/migration/adapters/zoho";
import { persistProviderRecords } from "@/utils/migration/analyze";
import { MIGRATION_ENGINE_VERSION } from "@/lib/migration/config";
import { MIGRATION_EVENTS, recordMigrationEvent } from "@/utils/migration/analytics";

/**
 * Zoho Books sync: pull read-only data into a Migration Engine import.
 *
 * The whole point of this route is the import preview through the Migration
 * Engine. It:
 *   1. refuses to run until an organization has been explicitly confirmed;
 *   2. creates an ImportJob (no files — a provider source);
 *   3. paginates each entity through the provider adapter (bounded, resumable
 *      via the adapter's opaque cursor);
 *   4. converts every record to canonical migration IR;
 *   5. persists the IR through `persistProviderRecords`, which runs the same
 *      relationship/dedupe/validate/plan machinery as a CSV import — so the
 *      user reviews Zoho data in the exact same UI with the same no-duplicate
 *      commit guarantee.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const ZOHO_ENTITIES = ["clients", "projects", "invoices", "expenses"] as const;

type ZohoCredentials = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  apiDomain: string;
  accountsServer: string;
};

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  if (!zohoBooksAvailable()) {
    return NextResponse.json({ success: false, message: "Zoho Books direct migration is not available." }, { status: 503 });
  }
  if (!rateLimit(`zoho-sync:${session.userId}:${getRequestIp(req)}`, 12, 60 * 60 * 1000)) {
    return NextResponse.json({ success: false, message: "Too many synchronization attempts." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const connectionId = typeof body?.connectionId === "string" ? body.connectionId : "";
  const connection = await prisma.connectorConnection.findFirst({
    where: { id: connectionId, userId: session.userId, provider: "zoho_books" },
  });
  if (!connection) return NextResponse.json({ success: false, message: "Zoho Books connection not found." }, { status: 404 });

  const settings = connection.settings as { organizationId?: string; organizationName?: string } | null;
  if (!settings?.organizationId) {
    return NextResponse.json(
      { success: false, message: "Choose a Zoho Books organization before importing." },
      { status: 400 },
    );
  }

  const run = await prisma.syncRun.create({
    data: {
      userId: session.userId,
      connectorConnectionId: connection.id,
      provider: "zoho_books",
      trigger: "manual",
      status: "running",
      attempts: 1,
      startedAt: new Date(),
    },
  });

  try {
    const credentials = decryptCalendarCredentials<ZohoCredentials>(connection.encryptedCredentials);
    const provider = createZohoProvider();
    // Fail closed on a stored API domain that is not a sanctioned Zoho host.
    const apiDomain = provider.resolveApiDomain(credentials);
    const fallbackCurrency = (settings as { currency?: string | null }).currency || "USD";

    const runZohoFetch = async (
      path: string,
      options?: { params?: Record<string, string> },
    ): Promise<unknown> => {
      const url = new URL(`/books/v3/${path.replace(/^\//, "")}`, apiDomain);
      for (const [key, value] of Object.entries(options?.params || {})) url.searchParams.set(key, value);
      const response = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${credentials.accessToken}` } });
      if (!response.ok) throw new Error(`Zoho Books request failed (${response.status}).`);
      return response.json();
    };

    const migration = await prisma.importJob.create({
      data: {
        userId: session.userId,
        engineVersion: MIGRATION_ENGINE_VERSION,
        source: "zoho_books",
        sourceLabel: `Zoho Books · ${settings.organizationName || settings.organizationId}`,
        status: "profiling",
        phase: "analysis",
        defaultCurrency: fallbackCurrency,
      },
      select: { id: true },
    });
    await recordMigrationEvent(session.userId, MIGRATION_EVENTS.started, migration.id, {
      recordCount: 0,
      migrationVersion: MIGRATION_ENGINE_VERSION,
      sourceType: "zoho_books",
    });

    const providerRecords: ZohoRecord[] = [];
    let pagesFetched = 0;
    for (const entity of ZOHO_ENTITIES) {
      let cursor: string | null = null;
      for (let page = 1; page <= 100; page += 1) {
        const result = await provider.fetchPage(runZohoFetch, entity, cursor);
        providerRecords.push(...result.records);
        pagesFetched += 1;
        if (!result.nextCursor) break;
        cursor = result.nextCursor;
      }
    }

    const ir = providerRecords.map((record, index) =>
      provider.toRecordIR(record, {
        sourceId: `zoho-${connection.id}`,
        sourceRow: index + 1,
        defaultCurrency: fallbackCurrency,
      }),
    );

    const analysis = await persistProviderRecords(session.userId, migration.id, ir);

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        cursorAfter: { entityCounts: ZOHO_ENTITIES.length, pagesFetched, recordCount: providerRecords.length },
        summary: { migrationId: migration.id, recordCount: providerRecords.length },
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      runId: run.id,
      migrationId: migration.id,
      state: analysis.state,
      planHash: analysis.plan.planHash,
      recordCount: analysis.recordCount,
      reviewCount: analysis.plan.reviewItems.length,
      message: `${analysis.recordCount} records are ready to review before anything is written.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Zoho Books import failed.";
    await prisma.$transaction([
      prisma.syncRun.update({ where: { id: run.id }, data: { status: "failed", error: message, completedAt: new Date() } }),
      prisma.connectorConnection.update({ where: { id: connection.id }, data: { status: "error", lastError: message } }),
    ]);
    return NextResponse.json({ success: false, runId: run.id, message }, { status: 502 });
  }
}
