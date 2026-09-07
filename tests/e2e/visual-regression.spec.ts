import { expect, test, type Page, type Route } from "@playwright/test";

const majorPages = [
  { name: "overview", path: "/dashboard", heading: "Your business, at a glance" },
  { name: "calendar", path: "/calendar", heading: "Your work, on one timeline" },
  { name: "projects", path: "/workflow/projects", heading: "Projects" },
  { name: "clients", path: "/workflow/clients", heading: "Clients" },
  { name: "revenue", path: "/workflow/revenue", heading: "Revenue & invoices" },
  { name: "expenses", path: "/workflow/expenses", heading: "Expenses" },
  { name: "portfolio", path: "/portfolio", heading: "Portfolio Studio" },
  { name: "agreements", path: "/workflow/contracts", heading: "Agreements" },
] as const;

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 768, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`marketing home ${viewport.width}x${viewport.height} visual`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.setViewportSize(viewport);
    await page.goto("/", { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: /Your business should not need you as middleware/i })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`marketing-home-${viewport.width}x${viewport.height}.png`, { fullPage: false });
  });

  test(`marketing home dark ${viewport.width}x${viewport.height} visual`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.addInitScript(() => {
      window.localStorage.setItem("rive-color-theme", "dark");
    });
    await page.setViewportSize(viewport);
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("heading", { name: /Your business should not need you as middleware/i })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`marketing-home-dark-${viewport.width}x${viewport.height}.png`, { fullPage: false });
  });
}

const portfolioContent = {
  name: "Rive Visual Tester",
  profileImageUrl: "",
  headline: "Independent product designer building calm, useful software.",
  bio: "I help small teams shape focused products and ship dependable experiences.",
  location: "Bengaluru, India",
  availability: "Available for select product engagements",
  contactEmail: "visual@rive.test",
  social: [],
  projects: [{ id: "project-1", title: "Connected workspace", description: "A focused operating system for independent work.", role: "Product design", year: "2026", url: "", imageUrl: "", client: "Rive", timeline: "8 weeks", deliverables: ["Product design"], gallery: [], visibility: "public", challenge: "", solution: "", outcome: "", tools: ["Figma"] }],
  services: [{ id: "service-1", title: "Product design", description: "From product direction through production-ready interface design." }],
  testimonials: [],
  sections: [
    { key: "about", visible: true },
    { key: "projects", visible: true },
    { key: "services", visible: true },
    { key: "testimonials", visible: false },
    { key: "contact", visible: true },
  ],
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockVisualWorkspace(page: Page, guidance: "completed" | "active" | "activated" = "completed") {
  const activated = guidance === "activated";
  const guidanceDone = guidance === "completed" || activated;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === "/api/auth/session") {
      return json(route, {
        success: true,
        user: { id: "visual-user", name: "Rive Visual Tester", email: "visual@rive.test", plan: "pro", onboarding_status: "complete", display_currency: "USD" },
        featureAvailability: { agreements: true },
      });
    }
    if (pathname === "/api/notifications") return json(route, { success: true, notifications: [] });
    if (pathname === "/api/activation") return json(route, {
      success: true,
      activation: {
        goal: "organize",
        goalLabel: "Organize client work",
        outcome: "Keep client work, deadlines, and delivery in one place.",
        startingPath: "quickstart",
        activationStage: activated ? "activated" : "build",
        stageLabel: activated ? "Ready to run" : "Build your next useful step",
        recommendedAction: activated ? null : { id: "add_deadline", label: "Add a project deadline", description: "Deadlines flow into your calendar and next-action view.", href: "/workflow/projects" },
        secondaryActions: [{ id: "connect_calendar", label: "Connect your calendar", description: "Keep project milestones and scheduled work visible together.", href: "/calendar" }],
        milestones: [
          { id: "client", label: "First client", complete: true, href: "/workflow/clients" },
          { id: "project", label: "Active work", complete: true, href: "/workflow/projects" },
          { id: "deadline", label: "Deadline added", complete: activated, href: "/workflow/projects" },
        ],
        completed: activated ? 3 : 2,
        total: 3,
        percentage: activated ? 100 : 67,
        guidanceDismissed: false,
        guidanceCompleted: guidanceDone,
        automaticGuidanceStatus: guidance === "active" ? "available" : "completed",
        hasMeaningfulContext: true,
        unresolvedImportIssues: 0,
        counts: { clients: 3, projects: 3, invoices: 6, expenses: 6 },
        steps: [],
        next: { id: "deadline", label: "Deadline added", complete: false, href: "/workflow/projects" },
      },
    });
    if (pathname === "/api/rates") return json(route, { success: true, data: { base: "USD", date: "2026-08-07", rates: { USD: 1, INR: 83, EUR: 0.9, GBP: 0.8 } } });
    if (pathname === "/api/workflow/dashboard") {
      return json(route, {
        success: true,
        stats: { totalPaid: 5075, totalPending: 825, activeProjects: 3, totalExpenses: 522, netEarnings: 4553 },
        topClients: [], recentActivity: [],
        chartData: [
          { month: "Mar 2026", period: "2026-03", revenue: 900, expenses: 120 }, { month: "Apr 2026", period: "2026-04", revenue: 1350, expenses: 80 },
          { month: "May 2026", period: "2026-05", revenue: 1425, expenses: 112 }, { month: "Jun 2026", period: "2026-06", revenue: 1400, expenses: 90 },
          { month: "Jul 2026", period: "2026-07", revenue: 0, expenses: 120 }, { month: "Aug 2026", period: "2026-08", revenue: 0, expenses: 0 },
        ],
        activation: {
          goal: "organize", goalLabel: "Organize client work", outcome: "Keep client work, deadlines, and delivery in one place.", startingPath: "quickstart", activationStage: activated ? "activated" : "build", stageLabel: activated ? "Ready to run" : "Build your next useful step",
          recommendedAction: activated ? null : { id: "add_deadline", label: "Add a project deadline", description: "Deadlines flow into your calendar and next-action view.", href: "/workflow/projects" }, secondaryActions: [{ id: "connect_calendar", label: "Connect your calendar", description: "Keep project milestones and scheduled work visible together.", href: "/calendar" }],
          milestones: [
            { id: "client", label: "First client", complete: true, href: "/workflow/clients" },
            { id: "project", label: "Active work", complete: true, href: "/workflow/projects" },
            { id: "deadline", label: "Deadline added", complete: activated, href: "/workflow/projects" },
          ], completed: activated ? 3 : 2, total: 3, percentage: activated ? 100 : 67, guidanceDismissed: false, guidanceCompleted: guidanceDone, automaticGuidanceStatus: guidance === "active" ? "available" : "completed", hasMeaningfulContext: true,
          counts: { clients: 3, projects: 3, invoices: 6, expenses: 6 }, unresolvedImportIssues: 0,
          next: { id: "deadline", label: "Deadline added", complete: false, href: "/workflow/projects" }, steps: [],
        },
        profileReadiness: { completed: 5, total: 6, percentage: 83, substantial: true, signals: [] },
        insights: { collectionRate: 86, profitMargin: 90, overdueCount: 1, overdueAmount: 825, topExpenseCategory: "Software", topExpenseAmount: 220, upcomingProjects: [] },
        currency: { displayCurrency: "USD", ratesAsOf: "2026-08-07", conversionAvailable: true },
      });
    }
    if (pathname === "/api/workflow/projects") return json(route, { success: true, projects: [] });
    if (pathname === "/api/workflow/clients") return json(route, { success: true, clients: [] });
    if (pathname === "/api/workflow/invoices") return json(route, { success: true, invoices: [] });
    if (pathname === "/api/workflow/expenses") return json(route, { success: true, expenses: [] });
    if (pathname === "/api/workflow/contracts") return json(route, { success: true, contracts: [] });
    if (pathname === "/api/calendar/events") {
      return json(route, {
        success: true,
        events: [{
          id: "visual-calendar-event",
          calendarId: "rive-calendar",
          title: "Review portfolio typography",
          description: "Final design review",
          location: null,
          meetingUrl: null,
          startAt: "2026-08-10T07:30:00",
          endAt: "2026-08-10T09:00:00",
          startDate: null,
          endDate: null,
          allDay: false,
          timeZone: "UTC",
          availability: "busy",
          source: "rive",
          color: "#14B8A6",
          clientId: null,
          projectId: null,
          taskId: null,
          invoiceId: null,
          readOnly: false,
        }],
      });
    }
    if (pathname === "/api/calendar/calendars") return json(route, { success: true, calendars: [{ id: "rive-calendar", name: "Rive", color: "#2563EB", isDefault: true, isVisible: true, externalCalendars: [] }] });
    if (pathname === "/api/calendar/tasks") return json(route, { success: true, tasks: [] });
    if (pathname === "/api/calendar/connections") return json(route, { success: true, connections: [], connectorAvailability: { googleCalendar: false } });
    if (pathname === "/api/portfolio") {
      return json(route, { success: true, portfolio: { id: "portfolio-visual", slug: "rive-visual-tester", status: "published", templateKey: "minimal-pro", content: portfolioContent, theme: { accent: "#2563EB", mode: "light", radius: "soft" }, seo: { title: "Rive Visual Tester", description: "Independent product designer", indexable: true }, revision: 1 } });
    }
    if (pathname === "/api/portfolio/analytics") return json(route, { success: true, analytics: { totalViews: 0, uniqueVisitors: 0, averageViewsPerDay: 0, peakDay: null, timeline: [] } });
    if (pathname === "/api/onboarding") {
      return json(route, { success: true, user: { name: "Rive Visual Tester", profession: "Product designer", businessType: "freelancer", businessTypes: ["freelancer"], currency: "USD", timeZone: "UTC", avatarUrl: "", onboardingStatus: "complete", onboardingStep: 4, onboardingData: { goal: "organize", sources: [] } }, connections: [], businessConnections: [], connectorAvailability: { googleCalendar: false, zohoBooks: false } });
    }
    if (pathname === "/api/onboarding/import/jobs") return json(route, { success: true, jobs: [] });
    return json(route, { success: true });
  });
}

async function prepareVisualPage(page: Page, theme: "light" | "dark", viewport = { width: 1440, height: 900 }, guidance: "completed" | "active" | "activated" = "completed") {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date("2026-08-10T09:00:00.000Z"));
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem("rive-color-theme", selectedTheme);
    window.localStorage.setItem("rive:sidebar-collapsed", "false");
    const style = document.createElement("style");
    style.textContent = "nextjs-portal{display:none!important}*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}";
    document.documentElement.appendChild(style);
  }, theme);
  await mockVisualWorkspace(page, guidance);
}

async function expectDesktopVisualInvariants(page: Page, theme: "light" | "dark") {
  const logo = page.locator('[aria-label="rive."]').first();
  await expect(logo).toBeVisible();
  const colors = await logo.locator("span").evaluateAll((parts) => parts.map((part) => getComputedStyle(part).color));
  expect(colors).toEqual(theme === "dark" ? ["rgb(248, 250, 252)", "rgb(96, 165, 250)"] : ["rgb(12, 30, 54)", "rgb(37, 99, 235)"]);

  const geometry = await page.evaluate(() => {
    const aside = document.querySelector("aside")?.getBoundingClientRect();
    const main = document.querySelector("main.flex-1")?.getBoundingClientRect();
    const heading = document.querySelector("main.flex-1 h1")?.getBoundingClientRect();
    return { asideWidth: aside?.width || 0, headingLeft: heading?.left || 0, mainLeft: main?.left || 0, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth };
  });
  expect(geometry.asideWidth).toBe(256);
  // CSS grid/flex layout can resolve the same 40px inset to a fractional
  // subpixel value (for example 40.28px) at some viewport sizes. The
  // invariant is about the intended whole-pixel spacing, so round before
  // asserting it rather than making the threshold artificially permissive.
  const contentInset = Math.round(geometry.headingLeft - geometry.mainLeft);
  expect(contentInset).toBeGreaterThanOrEqual(24);
  expect(contentInset).toBeLessThanOrEqual(40);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

for (const pageDefinition of majorPages) {
  for (const theme of ["light", "dark"] as const) {
    test(`${pageDefinition.name} ${theme} visual`, async ({ page }) => {
      await prepareVisualPage(page, theme);
      await page.goto(pageDefinition.path, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: pageDefinition.heading }).first()).toBeVisible({ timeout: 20_000 });
      await page.evaluate(() => document.fonts.ready);
      await expectDesktopVisualInvariants(page, theme);
      await expect(page).toHaveScreenshot(`${pageDefinition.name}-${theme}-1440x900.png`, { fullPage: false });
    });
  }
}

for (const { width, height } of [{ width: 1280, height: 800 }, { width: 1024, height: 768 }]) {
  for (const theme of ["light", "dark"] as const) {
    test(`overview ${theme} ${width}x${height} visual`, async ({ page }) => {
      await prepareVisualPage(page, theme, { width, height });
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Your business, at a glance" })).toBeVisible({ timeout: 20_000 });
      await page.evaluate(() => document.fonts.ready);
      await expectDesktopVisualInvariants(page, theme);
      await expect(page).toHaveScreenshot(`overview-${theme}-${width}x${height}.png`, {
        fullPage: false,
        ...(width === 1024 ? { maxDiffPixelRatio: 0.12 } : {}),
      });
    });
  }
}

test("financial overview reveals exact month values without a moving tooltip", async ({ page }) => {
  await prepareVisualPage(page, "light");
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  const chart = page.getByRole("region", { name: "Paid invoices and expenses" });
  await expect(chart).toBeVisible({ timeout: 20_000 });
  await expect(chart.getByText("Jul 2026", { exact: true }).first()).toBeVisible();
  const april = chart.getByRole("button", { name: /Apr 2026: \$1,350\.00 paid invoice value/ });
  await april.focus();
  await expect(april).toHaveAttribute("aria-pressed", "true");
  await expect(chart.getByText("$1,350.00", { exact: true })).toBeVisible();
  await expect(chart.getByText("$80.00", { exact: true })).toBeVisible();
  await expect(chart.getByText("$1,270.00", { exact: true })).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  test(`active guidance ${theme} visual`, async ({ page }) => {
    await prepareVisualPage(page, theme, { width: 1440, height: 900 }, "active");
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Expand guide" }).click();
    await expect(page.getByTestId("guide-dock")).toHaveAttribute("data-guide-state", "expanded");
    await expect(page.locator('[data-guide-target="activation-primary"]').last()).toHaveAttribute("data-guide-highlight", "true");
    await expect(page).toHaveScreenshot(`guidance-active-${theme}-1440x900.png`, { fullPage: false });
  });

  test(`help guides ${theme} visual`, async ({ page }) => {
    await prepareVisualPage(page, theme);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Help & guides" }).click();
    await expect(page.getByTestId("help-guides-panel")).toBeVisible();
    await expect(page).toHaveScreenshot(`help-guides-${theme}-1440x900.png`, { fullPage: false });
  });

  test(`getting started expanded ${theme} visual`, async ({ page }) => {
    await prepareVisualPage(page, theme);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Open Getting Started" }).click();
    await expect(page.getByTestId("getting-started-panel")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator("main").evaluate((main) => {
      main.scrollTop = 0;
      main.scrollLeft = 0;
    });
    await expect(page).toHaveScreenshot(`getting-started-expanded-${theme}-1440x900.png`, { fullPage: false });
  });

  test(`manual completion ${theme} visual`, async ({ page }) => {
    await prepareVisualPage(page, theme, { width: 1440, height: 900 }, "activated");
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Help & guides" }).click();
    await page.getByTestId("guide-option-organize").click();
    await expect(page.getByRole("heading", { name: "Guide completed" })).toBeVisible();
    await expect(page).toHaveScreenshot(`guidance-complete-${theme}-1440x900.png`, { fullPage: false });
  });
}

test("active guidance mobile visual", async ({ page }) => {
  await prepareVisualPage(page, "light", { width: 390, height: 844 }, "active");
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Expand guide" }).click();
  await expect(page.getByTestId("guide-dock")).toHaveAttribute("data-guide-state", "expanded");
  await expect(page).toHaveScreenshot("guidance-active-light-390x844.png", { fullPage: false });
});

for (const theme of ["light", "dark"] as const) {
  test(`calendar week ${theme} 1024x768 visual`, async ({ page }) => {
    await prepareVisualPage(page, theme, { width: 1024, height: 768 });
    await page.goto("/calendar", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Your work, on one timeline" })).toBeVisible({ timeout: 20_000 });
    const dismissGuide = page.getByRole("button", { name: /got it, hide this/i });
    if (await dismissGuide.isVisible()) await dismissGuide.click();
    await page.getByRole("button", { name: /^week$/i }).click();
    await expect(page.locator('[data-calendar-hour-label="7"]')).toBeVisible();
    const calendarGeometry = await page.evaluate(() => {
      const header = document.querySelector("[data-calendar-week-header]")?.getBoundingClientRect();
      const body = document.querySelector("[data-calendar-week-body]")?.getBoundingClientRect();
      const firstLabel = document.querySelector('[data-calendar-hour-label="7"]')?.getBoundingClientRect();
      return {
        headerBottom: header?.bottom || 0,
        bodyTop: body?.top || 0,
        labelTop: firstLabel?.top || 0,
      };
    });
    expect(calendarGeometry.bodyTop).toBeGreaterThanOrEqual(calendarGeometry.headerBottom - 1);
    expect(calendarGeometry.labelTop).toBeGreaterThan(calendarGeometry.bodyTop + 4);
    await page.locator("[data-calendar-week-header]").scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`calendar-week-${theme}-1024x768.png`, { fullPage: false, maxDiffPixelRatio: 0.12 });
  });

  /* Screenshot coverage is back on, against baselines regenerated at the end of
     the studio redesign rather than during it. It was suspended deliberately
     while the screen was moving — work-first navigation, the worklist above the
     shell, the template gallery, the publish review — because a baseline
     rewritten on every commit checks nothing at all.

     Regenerate on the CI runner, never locally: Chromium's Linux font stack
     rendered the committed images and no developer machine reproduces it. Use
     the `Regenerate visual baselines` workflow.

     The geometry checks here still run, and the public portfolio renderer —
     which this redesign does not touch — keeps its own screenshot coverage
     further down this file. */
  test(`portfolio editor ${theme} 1024x768 layout`, async ({ page }) => {
    await prepareVisualPage(page, theme, { width: 1024, height: 768 });
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });
    const sectionGeometry = await page.locator("[data-portfolio-section]").evaluateAll((buttons) => buttons.map((button) => {
      const buttonRect = button.getBoundingClientRect();
      const copyRect = button.querySelector("span")?.getBoundingClientRect();
      return { left: buttonRect.left, width: buttonRect.width, copyLeft: copyRect?.left || 0 };
    }));
    const lefts = sectionGeometry.map((item) => item.left);
    const widths = sectionGeometry.map((item) => item.width);
    const copyLefts = sectionGeometry.map((item) => item.copyLeft);
    expect(Math.max(...lefts) - Math.min(...lefts)).toBeLessThanOrEqual(1);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
    expect(Math.max(...copyLefts) - Math.min(...copyLefts)).toBeLessThanOrEqual(1);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`portfolio-editor-${theme}-1024x768.png`, { fullPage: false, maxDiffPixelRatio: 0.12 });
  });
}

test("portfolio sticky action bar stays flush with the scroll viewport", async ({ page }) => {
  await prepareVisualPage(page, "light", { width: 1440, height: 900 });
  await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

  await page.locator("main").evaluate((main) => { main.scrollTop = 520; });
  const geometry = await page.evaluate(() => {
    const main = document.querySelector("main")?.getBoundingClientRect();
    const actions = document.querySelector("[data-portfolio-sticky-actions]")?.getBoundingClientRect();
    return {
      actionsTop: actions?.top || 0,
      mainTop: main?.top || 0,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });

  expect(Math.abs(geometry.actionsTop - geometry.mainTop)).toBeLessThanOrEqual(1);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
});

test("deep portfolio form focus cannot scroll the dashboard document", async ({ page }) => {
  await prepareVisualPage(page, "light", { width: 1920, height: 900 });
  await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

  /* Make the editor genuinely deep, then use the browser's normal focus path
     on a control near its bottom. This is the interaction that used to scroll
     the document instead of the dashboard's <main> scroll region. */
  const addProject = page.getByRole("button", { name: "Add project" });
  for (let index = 0; index < 6; index += 1) await addProject.click();
  const target = page.getByPlaceholder("https://example.com").last();
  await expect(target).toBeVisible();
  const before = await page.evaluate(() => ({
    documentScrollHeight: document.documentElement.scrollHeight,
    viewportHeight: document.documentElement.clientHeight,
    shellTop: document.querySelector("[data-dashboard-shell]")?.getBoundingClientRect().top ?? 0,
  }));
  expect(before.documentScrollHeight).toBeLessThanOrEqual(before.viewportHeight + 1);
  expect(before.shellTop).toBeLessThanOrEqual(1);

  await target.focus();
  await page.waitForTimeout(50);
  const after = await page.evaluate(() => ({
    documentScrollTop: document.documentElement.scrollTop,
    documentScrollHeight: document.documentElement.scrollHeight,
    viewportHeight: document.documentElement.clientHeight,
    shellTop: document.querySelector("[data-dashboard-shell]")?.getBoundingClientRect().top ?? 0,
    mainScrollTop: document.querySelector("main")?.scrollTop ?? 0,
  }));
  expect(after.documentScrollTop, "deep focus must not move the document behind the app shell").toBe(0);
  expect(after.documentScrollHeight).toBeLessThanOrEqual(after.viewportHeight + 1);
  expect(Math.abs(after.shellTop)).toBeLessThanOrEqual(1);
  expect(after.mainScrollTop, "the inner workspace should own the scroll").toBeGreaterThan(0);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  test(`portfolio studio avoids viewport-sized bottom whitespace ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await prepareVisualPage(page, "light", viewport);
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Portfolio Studio" })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Testimonials" }).click();
    const editorMetrics = await page.evaluate(() => {
      const shell = document.querySelector("[data-portfolio-editor-shell]");
      const shellRect = shell?.getBoundingClientRect();
      return {
        shellHeight: shellRect?.height || 0,
        minHeight: shell ? getComputedStyle(shell).minHeight : "",
      };
    });
    expect(editorMetrics.minHeight).toBe("0px");
    expect(editorMetrics.shellHeight).toBeLessThan(680);

    /* This used to open the Preview tab and require the frame to stay under
       75vh, because a tall pane in a normal page flow left a screen of
       whitespace under it. There is no Preview tab now — the preview is a
       full-screen layer, where filling the viewport is the point. The concern
       it was guarding survives in a different form: the layer must fit the
       screen exactly, never overflow it or add scroll to the page behind. */
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.getByRole("dialog", { name: /full-screen portfolio preview/i })).toBeVisible();

    const previewMetrics = await page.evaluate(() => {
      const frame = document.querySelector('iframe[title$="portfolio preview"]');
      const rect = frame?.getBoundingClientRect();
      return {
        height: rect?.height ?? 0,
        bottom: rect?.bottom ?? 0,
        minHeight: frame ? getComputedStyle(frame).minHeight : "",
        documentScrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      };
    });
    expect(previewMetrics.minHeight).toBe("0px");
    expect(previewMetrics.height, "the overlay frame must have real room").toBeGreaterThan(200);
    expect(previewMetrics.bottom, "the overlay must not run off the bottom of the screen").toBeLessThanOrEqual(viewport.height + 1);
    expect(
      previewMetrics.documentScrollHeight,
      "a scroll-locked overlay must not leave the page behind it taller than the screen",
    ).toBeLessThanOrEqual(previewMetrics.clientHeight + 1);
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`mobile shell and onboarding ${theme} visual`, async ({ page }) => {
    await prepareVisualPage(page, theme, { width: 390, height: 844 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Your business, at a glance" })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("aside")).toBeHidden();
    await expect(page).toHaveScreenshot(`overview-${theme}-390x844.png`, { fullPage: false });

    await page.goto("/onboarding?restart=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "What kind of work do you run?" })).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveScreenshot(`onboarding-${theme}-390x844.png`, { fullPage: false });
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`onboarding ${theme} desktop visual`, async ({ page }) => {
    await prepareVisualPage(page, theme);
    await page.goto("/onboarding?restart=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "What kind of work do you run?" })).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveScreenshot(`onboarding-${theme}-1440x900.png`, { fullPage: false });
  });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`public portfolio ${viewport.width}x${viewport.height} visual`, async ({ page }) => {
      test.skip(!process.env.DATABASE_URL, "Public portfolio rendering is database-backed and needs a local test database.");
    await page.setViewportSize(viewport);
    await page.clock.setFixedTime(new Date("2026-08-10T09:00:00.000Z"));
    await page.goto("/p/e2e-workspace-portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Independent product designer building calm, useful software." })).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveScreenshot(`public-portfolio-${viewport.width}x${viewport.height}.png`, { fullPage: false });
  });
}
