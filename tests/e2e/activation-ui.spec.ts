import { expect, test, type Page } from "@playwright/test";

type Goal = "organize" | "get_paid" | "understand_finances" | "publish_portfolio" | "migrate";

type Counts = { clients: number; projects: number; invoices: number; expenses: number };

type MockState = {
  goal: Goal;
  counts: Counts;
  guidanceDismissed?: boolean;
  guidanceCompleted?: boolean;
  onboardingStatus?: "in_progress" | "complete" | "skipped";
  onboardingStep?: number;
  sources?: string[];
  startingPath?: string;
  projectDeadlineCount?: number;
  importJobCount?: number;
  unresolvedImportIssues?: number;
};

const goalLabels: Record<Goal, string> = {
  organize: "Organize client work",
  get_paid: "Get paid faster",
  understand_finances: "Understand my numbers",
  publish_portfolio: "Publish proof of work",
  migrate: "Move from another tool",
};

function action(id: string, label: string, href: string) {
  return { id, label, description: `${label} in this workspace.`, href };
}

function makePlan(state: MockState) {
  const { counts } = state;
  const hasFinancialContext = counts.invoices > 0 || counts.expenses > 0;
  let recommendedAction = action("first_client", "Add your first client", "/workflow/clients?new=true");
  let milestones = [
    { id: "client", label: "First client", complete: counts.clients > 0, href: "/workflow/clients" },
    { id: "project", label: "Active work", complete: counts.projects > 0, href: "/workflow/projects" },
    { id: "deadline", label: "Deadline added", complete: (state.projectDeadlineCount || 0) > 0, href: "/workflow/projects" },
  ];
  if (state.goal === "get_paid") {
    if (counts.clients > 0 && counts.projects === 0) recommendedAction = action("first_project", "Create your first project", "/workflow/projects?new=true");
    else if (counts.projects > 0 && counts.invoices === 0) recommendedAction = action("create_invoice", "Create your first invoice", "/workflow/revenue?new=true");
    else if (counts.invoices > 0) recommendedAction = action("send_invoice", "Review and send an invoice", "/workflow/revenue");
    milestones = [
      { id: "client", label: "First client", complete: counts.clients > 0, href: "/workflow/clients" },
      { id: "project", label: "Active work", complete: counts.projects > 0, href: "/workflow/projects" },
      { id: "invoice", label: "Invoice ready", complete: counts.invoices > 0, href: "/workflow/revenue" },
      { id: "sent", label: "Invoice sent", complete: false, href: "/workflow/revenue" },
    ];
  } else if (state.goal === "understand_finances") {
    recommendedAction = !hasFinancialContext && !state.importJobCount
      ? action("import_work", "Import your work", "/onboarding?restart=1&focus=import")
      : counts.invoices === 0
        ? action("create_invoice", "Create your first invoice", "/workflow/revenue?new=true")
        : action("add_expense", "Log your first expense", "/workflow/expenses?new=true");
    milestones = [
      { id: "context", label: "Financial context", complete: hasFinancialContext, href: "/workflow/revenue" },
      { id: "revenue", label: "Revenue data", complete: counts.invoices > 0, href: "/workflow/revenue" },
      { id: "expenses", label: "Expense data", complete: counts.expenses > 0, href: "/workflow/expenses" },
    ];
  } else if (state.goal === "publish_portfolio") {
    recommendedAction = action("complete_profile", "Complete your profile", "/portfolio");
    milestones = [
      { id: "profile", label: "Profile ready", complete: false, href: "/portfolio" },
      { id: "project", label: "Project selected", complete: false, href: "/portfolio" },
      { id: "published", label: "Portfolio published", complete: false, href: "/portfolio" },
    ];
  } else if (state.goal === "migrate") {
    recommendedAction = state.importJobCount
      ? action("resolve_import", "Resolve imported records", "/onboarding?restart=1&focus=import")
      : action("import_work", "Import your work", "/onboarding?restart=1&focus=import");
    milestones = [
      { id: "import", label: "Work imported", complete: Boolean(state.importJobCount), href: "/onboarding?restart=1&focus=import" },
      { id: "resolved", label: "Records reviewed", complete: Boolean(state.importJobCount) && !state.unresolvedImportIssues, href: "/onboarding?restart=1&focus=import" },
      { id: "workspace", label: "Workspace ready", complete: counts.clients + counts.projects + counts.invoices + counts.expenses > 0, href: "/dashboard" },
    ];
  } else if (counts.clients > 0 && counts.projects === 0) {
    recommendedAction = action("first_project", "Create your first project", "/workflow/projects?new=true");
  } else if (counts.projects > 0 && !state.projectDeadlineCount) {
    recommendedAction = action("add_deadline", "Add a project deadline", "/workflow/projects");
  }
  const completed = milestones.filter((item) => item.complete).length;
  return {
    goal: state.goal,
    goalLabel: goalLabels[state.goal],
    outcome: "Keep the next useful step clear.",
    startingPath: state.startingPath || "quickstart",
    activationStage: completed === milestones.length ? "activated" : completed === 0 ? "start" : "build",
    stageLabel: completed === 0 ? "Start here" : "Build your next useful step",
    recommendedAction,
    secondaryActions: [],
    milestones,
    completed,
    total: milestones.length,
    percentage: Math.round((completed / milestones.length) * 100),
    guidanceDismissed: state.guidanceDismissed === true,
    guidanceCompleted: state.guidanceCompleted === true,
    automaticGuidanceStatus: state.guidanceCompleted ? "completed" : state.guidanceDismissed ? "dismissed" : "available",
    hasMeaningfulContext: counts.clients + counts.projects + counts.invoices + counts.expenses > 0,
    unresolvedImportIssues: state.unresolvedImportIssues || 0,
    counts,
    steps: milestones,
    next: milestones.find((item) => !item.complete) || null,
  };
}

function dashboardPayload(state: MockState) {
  const activation = makePlan(state);
  return {
    success: true,
    stats: { totalPaid: 0, totalPending: 0, activeProjects: state.counts.projects, totalExpenses: 0, netEarnings: 0 },
    topClients: [],
    recentActivity: [],
    chartData: [],
    activation,
    profileReadiness: { completed: 0, total: 6, percentage: 0, substantial: false, signals: [] },
    insights: { collectionRate: 0, profitMargin: 0, overdueCount: 0, overdueAmount: 0, topExpenseCategory: null, topExpenseAmount: 0, upcomingProjects: [] },
    currency: { displayCurrency: "USD", ratesAsOf: null, conversionAvailable: true },
  };
}

async function installWorkspaceMocks(page: Page, state: MockState) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    if (pathname === "/api/auth/session") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, user: { id: "activation-test-user", name: "Activation Tester", email: "activation@rive.test", plan: "free", onboarding_status: state.onboardingStatus || "complete", display_currency: "USD" }, featureAvailability: { agreements: true } }) });
    }
    if (pathname === "/api/activation" || pathname === "/api/workflow/dashboard") {
      const requestedGoal = url.searchParams.get("goal") as Goal | null;
      const responseState = requestedGoal && Object.prototype.hasOwnProperty.call(goalLabels, requestedGoal) ? { ...state, goal: requestedGoal } : state;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pathname === "/api/activation" ? { success: true, activation: makePlan(responseState) } : dashboardPayload(state)) });
    }
    if (pathname === "/api/guidance") {
      const body = request.postDataJSON() as Record<string, unknown> | null;
      if (body?.event === "skipped" && body.mode === "automatic") state.guidanceDismissed = true;
      if (body?.event === "completed" && body.mode === "automatic") state.guidanceCompleted = true;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    }
    if (pathname === "/api/notifications") {
      if (request.method() === "PATCH") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, notifications: [] }) });
    }
    if (pathname === "/api/rates") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { base: "USD", date: "2026-08-10", rates: { USD: 1 } } }) });
    if (pathname === "/api/workflow/clients") {
      if (request.method() === "POST") {
        state.counts.clients += 1;
        return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, client: { id: "client-1", name: "Client A" } }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, clients: [] }) });
    }
    if (pathname === "/api/workflow/projects") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as Record<string, unknown> | null;
        state.counts.projects += 1;
        if (body?.due_date || body?.dueDate) state.projectDeadlineCount = (state.projectDeadlineCount || 0) + 1;
        return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, project: { id: `project-${state.counts.projects}`, title: "Project A" } }) });
      }
      const projects = state.counts.projects > 0 ? [{
        id: "project-1",
        client_id: state.counts.clients > 0 ? "client-1" : null,
        title: "Project A",
        description: null,
        status: "active",
        priority: "medium",
        start_date: null,
        due_date: state.projectDeadlineCount ? "2026-09-01T00:00:00.000Z" : null,
        budget: null,
        currency: "USD",
        tags: [],
        client_name: state.counts.clients > 0 ? "Client A" : null,
        client_company: null,
        milestone_count: 0,
        completed_milestones: 0,
        contract_coverage: "undecided",
        external_contract_label: null,
        external_contract_url: null,
        contract_count: 0,
        latest_contract: null,
      }] : [];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, projects }) });
    }
    if (pathname === "/api/workflow/invoices") {
      if (request.method() === "POST") {
        state.counts.invoices += 1;
        return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, invoice: { id: "invoice-1" } }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, invoices: [] }) });
    }
    if (pathname === "/api/workflow/expenses") {
      if (request.method() === "POST") {
        state.counts.expenses += 1;
        return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, expense: { id: "expense-1" } }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, expenses: [] }) });
    }
    if (pathname === "/api/workflow/contracts") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, contracts: [] }) });
    if (pathname === "/api/calendar/events") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, events: [] }) });
    if (pathname === "/api/calendar/calendars") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, calendars: [] }) });
    if (pathname === "/api/calendar/tasks") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, tasks: [] }) });
    if (pathname === "/api/portfolio") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, portfolio: { id: "portfolio", slug: "activation-tester", status: "draft", content: { headline: "", bio: "", services: [], projects: [], contactEmail: "", location: "" }, theme: {}, seo: null, revision: 1, templateKey: "minimal-pro" } }) });
    return route.continue();
  });
}

async function installOnboardingMocks(page: Page, state: MockState) {
  await page.route("**/api/onboarding**", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, user: { name: "Activation Tester", profession: "Product designer", businessType: "freelancer", businessTypes: ["freelancer"], currency: "USD", timeZone: "UTC", avatarUrl: "", onboardingStatus: state.onboardingStatus || "in_progress", onboardingStep: state.onboardingStep || 0, onboardingData: { goal: state.goal, sources: state.sources || [], startingPath: state.startingPath, guidanceDismissed: state.guidanceDismissed, guidanceCompleted: state.guidanceCompleted } }, connections: [], businessConnections: [], connectorAvailability: { googleCalendar: false, zohoBooks: false } }) });
    }
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    if (body?.mode === "quickstart") {
      state.onboardingStatus = "complete";
      state.onboardingStep = 5;
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          result: { invoice: Number(body.invoiceAmount) > 0 ? { id: "invoice-1" } : null },
        }),
      });
    }
    if (body?.status === "complete") state.onboardingStatus = "complete";
    if (typeof body?.step === "number") state.onboardingStep = body.step;
    if (typeof body?.startingPath === "string") state.startingPath = body.startingPath;
    if (Array.isArray(body?.sources)) state.sources = body.sources.filter((value): value is string => typeof value === "string");
    if (typeof body?.guidanceDismissed === "boolean") state.guidanceDismissed = body.guidanceDismissed;
    if (typeof body?.guidanceCompleted === "boolean") state.guidanceCompleted = body.guidanceCompleted;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, user: { onboardingStatus: state.onboardingStatus, onboardingStep: state.onboardingStep } }) });
  });
  await page.route("**/api/onboarding/import/jobs", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, jobs: [] }) }));
  await page.route("**/api/uploads/presign", async (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Inline upload fallback" }) }));
}

test.describe("goal-aware activation", () => {
  test("registration pauses at email verification before onboarding", async ({ page }) => {
    const state: MockState = { goal: "organize", counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 }, onboardingStatus: "in_progress", onboardingStep: 0 };
    await installOnboardingMocks(page, state);
    await page.route("**/api/auth/register**", async (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, requiresEmailVerification: true }) }));
    await page.goto("/register?invite=test-invite", { waitUntil: "networkidle" });
    await page.getByLabel("Full name").fill("Activation Tester");
    await page.getByLabel("Email address").fill("activation@rive.test");
    await page.getByRole("textbox", { name: "Password" }).fill("activation-password");
    const createAccountButton = page.locator("form").getByRole("button", { name: "Create Account" });
    await expect(createAccountButton).toBeEnabled();
    await createAccountButton.click();
    await expect(page).toHaveURL(/\/register\?invite=test-invite$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Your account is ready. Check your inbox for the verification link.", { exact: true })).toBeVisible();
  });

  test("an incomplete user returns to the saved onboarding step after login", async ({ page }) => {
    const state: MockState = { goal: "get_paid", counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 }, onboardingStatus: "in_progress", onboardingStep: 2 };
    await installOnboardingMocks(page, state);
    await page.route("**/api/auth/login**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, destination: "/onboarding" }) }));
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByLabel("Email address").fill("activation@rive.test");
    await page.getByRole("textbox", { name: "Password" }).fill("activation-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Start with context, not an empty workspace." })).toBeVisible({ timeout: 15_000 });
  });

  test("a completed user logs in to the dashboard without reopening onboarding", async ({ page }) => {
    const state: MockState = { goal: "organize", counts: { clients: 1, projects: 1, invoices: 0, expenses: 0 }, onboardingStatus: "complete" };
    await installWorkspaceMocks(page, state);
    await page.route("**/api/auth/login**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, destination: "/dashboard" }) }));
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByLabel("Email address").fill("activation@rive.test");
    await page.getByRole("textbox", { name: "Password" }).fill("activation-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Your business, at a glance" })).toBeVisible();
    await expect(page).not.toHaveURL(/\/onboarding/, { timeout: 15_000 });
  });

  test("organize flow lands on Today with one guided next action", async ({ page }) => {
    const state: MockState = { goal: "organize", counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 } };
    await installWorkspaceMocks(page, state);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
    await expect(page.getByText("Add your first client").first()).toBeVisible();
    await expect(page.getByTestId("activation-card")).toBeVisible();
    await expect(page.getByText("More tools")).toBeVisible();
    await page.getByRole("button", { name: "Open Getting Started" }).click();
    await expect(page.getByTestId("getting-started-panel")).toBeVisible();
    await page.getByRole("link", { name: "Add your first client" }).last().click();
    await expect(page).toHaveURL(/\/workflow\/clients/, { timeout: 15_000 });
  });

  test("get-paid recommendation advances as client, project and invoice context appears", async ({ page }) => {
    const state: MockState = { goal: "get_paid", counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 } };
    await installWorkspaceMocks(page, state);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Add your first client").first()).toBeVisible();
    state.counts.clients = 1;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Create your first project").first()).toBeVisible();
    state.counts.projects = 1;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Create your first invoice").first()).toBeVisible();
    state.counts.invoices = 1;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Review and send an invoice").first()).toBeVisible();
  });

  test("publish-proof and migrate goals expose their correct first action", async ({ page }) => {
    const state: MockState = { goal: "publish_portfolio", counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 } };
    await installWorkspaceMocks(page, state);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Complete your profile").first()).toBeVisible();
    state.goal = "migrate";
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Import your work").first()).toBeVisible();
  });

  test("start-clean and incomplete onboarding remain resumable", async ({ page }) => {
    const state: MockState = { goal: "organize", counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 }, onboardingStatus: "in_progress", onboardingStep: 2 };
    await installWorkspaceMocks(page, state);
    await installOnboardingMocks(page, state);
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Start with context, not an empty workspace." })).toBeVisible();
    await page.getByRole("button", { name: "Start clean" }).click();
    await page.getByRole("button", { name: "Open my workspace" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    expect(state.onboardingStatus).toBe("complete");
  });

  test("mobile onboarding photo trigger opens the picker and keeps work cards left-aligned", async ({ page }) => {
    const state: MockState = { goal: "organize", counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 }, onboardingStatus: "in_progress", onboardingStep: 0 };
    await installWorkspaceMocks(page, state);
    await installOnboardingMocks(page, state);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/onboarding?restart=1", { waitUntil: "domcontentloaded" });

    const firstWorkType = page.getByTestId("onboarding-business-type-card").first();
    await expect(firstWorkType).toBeVisible();
    await expect(firstWorkType).toHaveCSS("justify-content", "flex-start");

    const chooser = page.waitForEvent("filechooser");
    await page.getByTestId("onboarding-avatar-upload").click();
    await (await chooser).setFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from("synthetic avatar"),
    });

    await expect(page.locator('img[alt=""]').first()).toBeVisible();
    await expect(page.getByText("Profile photo added.")).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });

  test("build one real workflow submits the workspace activation form", async ({ page }) => {
    const state: MockState = { goal: "organize", counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 }, onboardingStatus: "in_progress", onboardingStep: 2 };
    await installWorkspaceMocks(page, state);
    await installOnboardingMocks(page, state);
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Start with context, not an empty workspace." })).toBeVisible();
    await page.getByRole("button", { name: "Build one real workflow" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Start with work you are actually doing." })).toBeVisible();
    await page.getByLabel("Client name").fill("Northstar Studio");
    await page.getByLabel("Project").fill("Launch site");
    await page.getByRole("button", { name: "create my workspace" }).click();
    await expect(page.getByText("Workspace activated")).toBeVisible();
    expect(state.onboardingStatus).toBe("complete");
  });

  test("source context keeps existing records separate from a fresh start", async ({ page }) => {
    const state: MockState = { goal: "organize", counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 }, onboardingStatus: "in_progress", onboardingStep: 2 };
    await installWorkspaceMocks(page, state);
    await installOnboardingMocks(page, state);
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Spreadsheets / CSV" }).click();
    await page.getByRole("button", { name: "Zoho Books export" }).click();
    await expect(page.getByRole("button", { name: "Spreadsheets / CSV" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /Mostly starting fresh/ }).click();
    await expect(page.getByRole("button", { name: /Mostly starting fresh/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Spreadsheets / CSV" })).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("button", { name: "Zoho Books export" })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "QuickBooks export" }).click();
    await expect(page.getByRole("button", { name: "QuickBooks export" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /Mostly starting fresh/ })).toHaveAttribute("aria-pressed", "false");
  });

  test("skip setup is a durable choice and does not reopen guidance", async ({ page }) => {
    const state: MockState = { goal: "organize", counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 }, onboardingStatus: "in_progress", onboardingStep: 1 };
    await installWorkspaceMocks(page, state);
    await installOnboardingMocks(page, state);
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Skip setup" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByTestId("activation-card")).toBeHidden();
    expect(state.startingPath).toBe("skipped");
    expect(state.guidanceDismissed).toBe(true);
  });

  test("guidance dismissal persists and More tools keeps direct routes available", async ({ page }) => {
    const state: MockState = { goal: "organize", counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 } };
    await installWorkspaceMocks(page, state);
    await page.route("**/api/guidance", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as Record<string, unknown> | null;
        if (body?.event === "skipped") state.guidanceDismissed = true;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      }
      return route.continue();
    });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "More tools" }).click();
    await expect(page.getByRole("link", { name: "Portfolio" })).toBeVisible();
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Portfolio Studio")).toBeVisible();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Hide setup guidance" }).click();
    await expect(page.getByTestId("activation-card")).toBeHidden();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("activation-card")).toBeHidden();
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Portfolio Studio")).toBeVisible();
  });

  test("mobile first-run dashboard stays focused", async ({ page }) => {
    const state: MockState = { goal: "understand_finances", counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 } };
    await installWorkspaceMocks(page, state);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
    await expect(page.getByTestId("activation-card")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  });

  test("automatic guidance is skippable and does not return after refresh", async ({ page }) => {
    const state: MockState = { goal: "organize", counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 } };
    await installWorkspaceMocks(page, state);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("guide-popover")).toBeVisible();
    await expect(page.locator('[data-guide-target="activation-primary"]').last()).toHaveAttribute("data-guide-highlight", "true");
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByTestId("guide-popover")).toBeHidden();
    expect(state.guidanceDismissed).toBe(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("guide-popover")).toBeHidden();
  });

  test("guidance follows real workflow mutations instead of advancing on Next", async ({ page }) => {
    const state: MockState = { goal: "organize", counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 } };
    await installWorkspaceMocks(page, state);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Add your first client" })).toBeVisible();
    await page.evaluate(() => fetch("/api/workflow/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Client A" }) }));
    await expect(page.getByRole("heading", { name: "Create your first project" })).toBeVisible({ timeout: 8_000 });
    await page.evaluate(() => fetch("/api/workflow/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Project A" }) }));
    await expect(page.getByRole("heading", { name: "Add a project deadline" })).toBeVisible({ timeout: 8_000 });
    await page.evaluate(() => fetch("/api/workflow/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Project B", due_date: "2026-09-01" }) }));
    await expect(page.getByText("Meaningful first outcome reached.")).toBeVisible({ timeout: 8_000 });
  });

  test("existing users can launch an adaptive guide from Help without changing activation state", async ({ page }) => {
    const state: MockState = { goal: "organize", counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 }, guidanceDismissed: true, startingPath: "quickstart" };
    await installWorkspaceMocks(page, state);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("guide-popover")).toBeHidden();
    await page.getByRole("button", { name: "Help & guides" }).click();
    await page.getByRole("button", { name: "Organize clients & projects" }).click();
    await expect(page.getByTestId("guide-popover")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add your first client" })).toBeVisible();
    expect(state.guidanceDismissed).toBe(true);
    await page.getByRole("button", { name: "Close guide" }).click();
    await expect(page.getByTestId("guide-popover")).toBeHidden();
  });

  test("manual replay adapts when a workspace already has the guided outcome", async ({ page }) => {
    const state: MockState = { goal: "organize", counts: { clients: 1, projects: 1, invoices: 0, expenses: 0 }, projectDeadlineCount: 1, guidanceDismissed: true, startingPath: "quickstart" };
    await installWorkspaceMocks(page, state);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Help & guides" }).click();
    await page.getByRole("button", { name: "Organize clients & projects" }).click();
    await expect(page.getByRole("heading", { name: "You are ready to run with it" })).toBeVisible();
    await expect(page.getByText("Add your first client", { exact: true })).toHaveCount(0);
    expect(state.guidanceDismissed).toBe(true);
    await page.getByRole("button", { name: "Done" }).click();
  });

  test("deadline guidance opens the visible same-page action", async ({ page }) => {
    const state: MockState = { goal: "organize", counts: { clients: 1, projects: 1, invoices: 0, expenses: 0 }, guidanceDismissed: true, startingPath: "quickstart" };
    await installWorkspaceMocks(page, state);
    await page.goto("/workflow/projects", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Project A" })).toBeVisible();
    await page.getByRole("button", { name: "Help & guides" }).click();
    await page.getByRole("button", { name: "Organize clients & projects" }).click();
    await expect(page.getByRole("heading", { name: "Add a project deadline" })).toBeVisible();
    await page.getByRole("button", { name: "Open step", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Edit project" })).toBeVisible();
  });

  test("mobile guidance uses a bottom card and keeps the page within the viewport", async ({ page }) => {
    const state: MockState = { goal: "get_paid", counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 } };
    await installWorkspaceMocks(page, state);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("guide-popover")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Help & guides" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Skip" }).click();
  });

  test("Escape closes automatic guidance and Help is keyboard reachable", async ({ page }) => {
    const state: MockState = { goal: "organize", counts: { clients: 0, projects: 0, invoices: 0, expenses: 0 } };
    await installWorkspaceMocks(page, state);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("guide-popover")).toBeHidden();
    await page.getByRole("button", { name: "Help & guides" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("help-guides-panel")).toBeVisible();
  });
});
