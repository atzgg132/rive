import { expect, test, type Page, type Route } from "@playwright/test";

const majorPages = [
  { name: "overview", path: "/dashboard", heading: "Your workspace overview" },
  { name: "calendar", path: "/calendar", heading: "Every commitment, in one calendar" },
  { name: "projects", path: "/workflow/projects", heading: "Projects" },
  { name: "clients", path: "/workflow/clients", heading: "Clients" },
  { name: "revenue", path: "/workflow/revenue", heading: "Revenue & invoices" },
  { name: "expenses", path: "/workflow/expenses", heading: "Expenses" },
  { name: "portfolio", path: "/portfolio", heading: "Portfolio Studio" },
  { name: "agreements", path: "/workflow/contracts", heading: "Agreements" },
] as const;

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

async function mockVisualWorkspace(page: Page) {
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
    if (pathname === "/api/rates") return json(route, { success: true, data: { base: "USD", date: "2026-08-07", rates: { USD: 1, INR: 83, EUR: 0.9, GBP: 0.8 } } });
    if (pathname === "/api/workflow/dashboard") {
      return json(route, {
        success: true,
        stats: { totalPaid: 5075, totalPending: 825, activeProjects: 3, totalExpenses: 522, netEarnings: 4553 },
        topClients: [], recentActivity: [],
        chartData: [
          { month: "Mar", revenue: 900, expenses: 120 }, { month: "Apr", revenue: 1350, expenses: 80 },
          { month: "May", revenue: 1425, expenses: 112 }, { month: "Jun", revenue: 1400, expenses: 90 },
          { month: "Jul", revenue: 0, expenses: 120 }, { month: "Aug", revenue: 0, expenses: 0 },
        ],
        activation: {
          counts: { clients: 3, projects: 3, invoices: 6, expenses: 6 }, completed: 5, total: 6, unresolvedImportIssues: 0,
          next: { id: "calendar", label: "Calendar connected", complete: false, href: "/calendar" },
          steps: [
            { id: "profile", label: "Profile ready", complete: true, href: "/portfolio" },
            { id: "client", label: "First client", complete: true, href: "/workflow/clients" },
            { id: "project", label: "Active work", complete: true, href: "/workflow/projects" },
            { id: "money", label: "Financial context", complete: true, href: "/workflow/revenue" },
            { id: "calendar", label: "Calendar connected", complete: false, href: "/calendar" },
            { id: "portfolio", label: "Portfolio ready", complete: true, href: "/portfolio" },
          ],
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
    if (pathname === "/api/calendar/events") return json(route, { success: true, events: [] });
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

async function prepareVisualPage(page: Page, theme: "light" | "dark", viewport = { width: 1440, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date("2026-08-10T09:00:00.000Z"));
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem("rive-color-theme", selectedTheme);
    window.localStorage.setItem("rive:sidebar-collapsed", "false");
    const style = document.createElement("style");
    style.textContent = "nextjs-portal{display:none!important}*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}";
    document.documentElement.appendChild(style);
  }, theme);
  await mockVisualWorkspace(page);
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
  expect(geometry.headingLeft - geometry.mainLeft).toBeGreaterThanOrEqual(24);
  expect(geometry.headingLeft - geometry.mainLeft).toBeLessThanOrEqual(40);
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
      await expect(page.getByRole("heading", { name: "Your workspace overview" })).toBeVisible({ timeout: 20_000 });
      await page.evaluate(() => document.fonts.ready);
      await expectDesktopVisualInvariants(page, theme);
      await expect(page).toHaveScreenshot(`overview-${theme}-${width}x${height}.png`, { fullPage: false });
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  test(`mobile shell and onboarding ${theme} visual`, async ({ page }) => {
    await prepareVisualPage(page, theme, { width: 390, height: 844 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Your workspace overview" })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("aside")).toBeHidden();
    await expect(page).toHaveScreenshot(`overview-${theme}-390x844.png`, { fullPage: false });

    await page.goto("/onboarding?restart=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Tell us enough to personalize everything else." })).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveScreenshot(`onboarding-${theme}-390x844.png`, { fullPage: false });
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`onboarding ${theme} desktop visual`, async ({ page }) => {
    await prepareVisualPage(page, theme);
    await page.goto("/onboarding?restart=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Tell us enough to personalize everything else." })).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveScreenshot(`onboarding-${theme}-1440x900.png`, { fullPage: false });
  });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`public portfolio ${viewport.width}x${viewport.height} visual`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.clock.setFixedTime(new Date("2026-08-10T09:00:00.000Z"));
    await page.goto("/p/e2e-workspace-portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Independent product designer building calm, useful software." })).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveScreenshot(`public-portfolio-${viewport.width}x${viewport.height}.png`, { fullPage: false });
  });
}
