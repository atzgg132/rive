import { expect, test, type Page, type Route } from "@playwright/test";

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

const longName = "Alexandria Northstar-Smith Consulting Partnership";
const longEmail = "alexandria.northstar-smith.consulting.partnership@example.test";

const project = {
  id: "project-shell",
  client_id: null,
  title: "Northstar Labs marketing site with a deliberately long title",
  description: "A long project description stays subordinate to the useful metadata.",
  status: "active",
  priority: "high",
  start_date: "2026-08-01",
  due_date: "2026-09-30",
  budget: "125000",
  currency: "USD",
  tags: [],
  client_name: "Northstar Labs",
  client_company: "Northstar Labs",
  milestone_count: 3,
  completed_milestones: 1,
  contract_coverage: "undecided",
  external_contract_label: null,
  external_contract_url: null,
  contract_count: 0,
  latest_contract: null,
};

async function mockWorkspace(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === "/api/auth/session") {
      return json(route, {
        success: true,
        user: {
          id: "user-shell",
          name: longName,
          email: longEmail,
          plan: "pro",
          onboarding_status: "complete",
          currency: "USD",
          display_currency: "USD",
          display_currency_source: "legacy",
        },
        featureAvailability: { agreements: true, engagementFlow: false },
      });
    }
    if (pathname === "/api/workflow/projects") {
      return json(route, {
        success: true,
        projects: [project],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
        counts: { all: 1, active: 1, paused: 0, completed: 0, overdue: 0 },
      });
    }
    if (pathname === "/api/workflow/clients") return json(route, { success: true, clients: [] });
    if (pathname === "/api/rates") return json(route, { success: true, data: { base: "USD", date: "2026-09-09", rates: {} } });
    if (pathname === "/api/activation") return json(route, { success: true, activation: null });
    if (pathname === "/api/notifications") return json(route, { success: true, notifications: [] });
    if (pathname === "/api/workflow/search") {
      const query = url.searchParams.get("q");
      if (query === "slow") await new Promise((resolve) => setTimeout(resolve, 350));
      return json(route, {
        success: true,
        query,
        limit: 30,
        results: query === "fast"
          ? [{ kind: "project", type: "project", id: "project-shell", title: "Fast project", subtitle: "Northstar Labs", status: "active", href: "/workflow/projects/project-shell" }]
          : [{ kind: "project", type: "project", id: "project-shell", title: "Northstar Labs marketing site", subtitle: "Northstar Labs", status: "active", href: "/workflow/projects/project-shell" }],
      });
    }
    return json(route, { success: true });
  });
}

test("desktop sidebar keeps long identity values contained and persists the rail", async ({ page }) => {
  await mockWorkspace(page);
  await page.goto("/workflow/projects", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Northstar Labs marketing site/ })).toBeVisible();

  const sidebar = page.locator("#dashboard-desktop-sidebar");
  await expect(sidebar).toHaveAttribute("data-sidebar-collapsed", "false");
  await expect(sidebar.locator("[data-sidebar-identity] span[title]").first()).toHaveCSS("white-space", "nowrap");
  await expect(sidebar.getByText("pro", { exact: true })).toBeVisible();

  const collapse = sidebar.getByRole("button", { name: "Collapse sidebar" });
  await collapse.click();
  await expect(sidebar).toHaveAttribute("data-sidebar-collapsed", "true");
  await expect(sidebar.getByRole("link", { name: "Projects" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Projects" }).locator("span")).toHaveCount(0);
  const collapsedRailGeometry = await sidebar.evaluate((element) => {
    const header = element.querySelector<HTMLElement>("[data-sidebar-header]");
    const logo = element.querySelector<SVGSVGElement>("[data-sidebar-header] [data-sidebar-logo] svg");
    const toggle = element.querySelector<HTMLElement>("[data-sidebar-header] [data-sidebar-toggle]");
    const headerBox = header?.getBoundingClientRect();
    const logoBox = logo?.getBoundingClientRect();
    const toggleBox = toggle?.getBoundingClientRect();
    return {
      headerHeight: headerBox?.height || 0,
      logoWidth: logoBox?.width || 0,
      logoHeight: logoBox?.height || 0,
      logoCenter: logoBox ? logoBox.x + logoBox.width / 2 : 0,
      toggleCenter: toggleBox ? toggleBox.x + toggleBox.width / 2 : 0,
      toggleWidth: toggleBox?.width || 0,
      toggleHeight: toggleBox?.height || 0,
      logoToToggleGap: logoBox && toggleBox ? toggleBox.top - logoBox.bottom : 0,
    };
  });
  expect(collapsedRailGeometry.headerHeight).toBeGreaterThanOrEqual(84);
  expect(collapsedRailGeometry.logoHeight).toBeLessThanOrEqual(21);
  expect(collapsedRailGeometry.logoWidth).toBeLessThan(60);
  expect(collapsedRailGeometry.toggleWidth).toBeGreaterThanOrEqual(44);
  expect(collapsedRailGeometry.toggleHeight).toBeGreaterThanOrEqual(44);
  expect(collapsedRailGeometry.logoToToggleGap).toBeGreaterThanOrEqual(6);
  expect(Math.abs(collapsedRailGeometry.logoCenter - collapsedRailGeometry.toggleCenter)).toBeLessThanOrEqual(1);

  await page.reload({ waitUntil: "domcontentloaded" });
  const collapsedSidebar = page.locator("#dashboard-desktop-sidebar");
  await expect(collapsedSidebar).toHaveAttribute("data-sidebar-collapsed", "true");
  const avatar = collapsedSidebar.locator("[data-sidebar-identity][aria-haspopup=dialog]");
  await avatar.click({ force: true });
  const identityDialog = page.getByRole("dialog", { name: "Workspace account" });
  await expect(identityDialog).toContainText(longName);
  await expect(identityDialog).toContainText(longEmail);
  await page.keyboard.press("Escape");
  await expect(avatar).toBeFocused();
});

test("mobile drawer, command search, and stale responses remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockWorkspace(page);
  await page.goto("/workflow/projects", { waitUntil: "domcontentloaded" });

  const header = page.locator("header");
  const openNavigation = header.getByRole("button", { name: "Open navigation" });
  await openNavigation.click();
  const drawer = page.getByRole("dialog", { name: "Workspace navigation" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(longName)).toBeVisible();
  await expect(drawer.getByText("pro", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(openNavigation).toBeFocused();

  const search = header.getByRole("button", { name: "Search workspace" });
  await search.click();
  const input = page.getByRole("combobox", { name: "Global Command Menu" });
  await input.fill("slow");
  await input.fill("fast");
  await expect(page.getByText("Fast project", { exact: true })).toBeVisible();
  await expect(page.getByText("Northstar Labs marketing site", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(search).toBeFocused();
});

test("toolbar menus stay anchored and restore focus after selection", async ({ page }) => {
  await mockWorkspace(page);
  await page.goto("/workflow/projects", { waitUntil: "domcontentloaded" });

  const trigger = page.locator("#projects-sort");
  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const triggerBox = await trigger.boundingBox();
  const menuBox = await menu.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  expect(Math.abs(((menuBox?.x || 0) + (menuBox?.width || 0)) - ((triggerBox?.x || 0) + (triggerBox?.width || 0)))).toBeLessThanOrEqual(2);

  await menu.getByRole("menuitem", { name: "Title A–Z" }).click();
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("project cards have no viewport overflow at supported shell widths", async ({ page }) => {
  await mockWorkspace(page);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/workflow/projects", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Northstar Labs marketing site/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `viewport ${width}px`).toBeLessThanOrEqual(1);
  }
});
