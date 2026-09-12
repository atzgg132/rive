import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/utils/adminSession";
import { getAdminCohortUsers, type AdminUserIndexEntry } from "@/utils/adminMetrics";

const STAGES = new Set(["all", "registered", "qualified", "activated", "deeply_activated"]);
const EXPORT_CAP = 5000;

// Stage filters are cumulative to match the Overview cards: "Qualified" is every
// qualified account (activated included), so the table count equals the card.
function matchesStage(user: AdminUserIndexEntry, stage: string): boolean {
  if (stage === "registered") return !user.qualified;
  if (stage === "qualified") return user.qualified;
  if (stage === "activated") return user.activated;
  if (stage === "deeply_activated") return user.deeplyActivated;
  return true;
}

export async function GET(req: NextRequest) {
  if (!await hasAdminSession(req)) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const page = Math.max(Number.parseInt(params.get("page") || "1", 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(params.get("pageSize") || "25", 10) || 25, 1), 50);
  const search = (params.get("search") || "").trim().toLowerCase();
  const stage = STAGES.has(params.get("stage") || "") ? params.get("stage")! : "all";
  const verified = params.get("verified");
  const realData = params.get("realData") === "true";
  const source = (params.get("source") || "").trim();

  const cohort = await getAdminCohortUsers();
  const matchesNonStage = (user: AdminUserIndexEntry) => (
    (!search || user.email.toLowerCase().includes(search) || (user.name || "").toLowerCase().includes(search))
    && (verified !== "true" && verified !== "false" || String(user.emailVerified) === verified)
    && (!realData || user.realData)
    && (!source || user.source === source)
  );

  // Chip counts answer "how many rows would this stage show here", so they are
  // computed over every other active filter — but never the stage itself.
  const base = cohort.filter(matchesNonStage);
  const facets = {
    all: base.length,
    registered: base.filter((user) => !user.qualified).length,
    qualified: base.filter((user) => user.qualified).length,
    activated: base.filter((user) => user.activated).length,
    deeply_activated: base.filter((user) => user.deeplyActivated).length,
    unverified: base.filter((user) => !user.emailVerified).length,
    realData: base.filter((user) => user.realData).length,
  };

  const filtered = base.filter((user) => matchesStage(user, stage));

  if (params.get("export") === "emails") {
    return NextResponse.json({ success: true, total: filtered.length, emails: filtered.slice(0, EXPORT_CAP).map((user) => user.email) });
  }

  const total = filtered.length;
  const data = filtered.slice((page - 1) * pageSize, page * pageSize);
  return NextResponse.json({
    success: true,
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
    facets,
    sources: Array.from(new Set(cohort.map((user) => user.source))).sort(),
    data,
  });
}
