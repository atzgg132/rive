import { expect, test, type Page, type Route } from "@playwright/test";

const client = {
  id: "client-1",
  name: "Acme Studio",
  email: "contracts@acme.test",
  company: "Acme Private Limited",
  address: "Bengaluru, Karnataka, India",
  status: "active",
};

const project = {
  id: "project-1",
  title: "Website redesign",
  description: "Research, UX design, responsive implementation, and launch support.",
  client_id: client.id,
  client_name: client.name,
  client_company: client.company,
  status: "active",
  priority: "medium",
  start_date: "2026-08-01T00:00:00.000Z",
  due_date: "2026-10-15T00:00:00.000Z",
  budget: "120000",
  currency: "INR",
  tags: [],
  milestone_count: 2,
  completed_milestones: 0,
  contract_coverage: "undecided",
  external_contract_label: null,
  external_contract_url: null,
  contract_count: 0,
  latest_contract: null,
  milestones: [
    { id: "milestone-1", title: "Design approval", dueDate: "2026-09-01T00:00:00.000Z", completed: false },
    { id: "milestone-2", title: "Production launch", dueDate: "2026-10-15T00:00:00.000Z", completed: false },
  ],
};

const template = {
  title: "Website redesign — Services agreement",
  currency: "INR",
  governing_law: "India",
  jurisdiction: "Bengaluru, Karnataka",
  owner: { name: "Rive Freelancer", email: "owner@rive.test" },
  client,
  project: {
    id: project.id,
    title: project.title,
    description: project.description,
    budget: project.budget,
    currency: project.currency,
    due_date: project.due_date,
    milestones: project.milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      due_date: milestone.dueDate,
      completed: milestone.completed,
    })),
  },
  sections: [
    {
      key: "parties",
      title: "Parties and engagement",
      body: "Rive Freelancer will provide the services described in this agreement to Acme Studio.",
      enabled: true,
      required: true,
    },
    {
      key: "scope",
      title: "Services and scope",
      body: project.description,
      enabled: true,
      required: false,
    },
  ],
  readiness: { can_share_for_review: true, can_start_signing: true, notices: [] },
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockWorkspace(
  page: Page,
  options: { onCoverage?: (payload: Record<string, unknown>) => void } = {},
) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/auth/session") {
      return json(route, {
        success: true,
        user: {
          id: "user-1",
          name: "Rive Freelancer",
          email: "owner@rive.test",
          plan: "free",
          currency: "INR",
          display_currency: "INR",
          onboarding_status: "complete",
        },
        featureAvailability: { agreements: true },
      });
    }
    if (url.pathname === "/api/rates") return json(route, { success: true, data: { base: "USD", date: "2026-08-07", rates: { INR: 83, EUR: 0.9, GBP: 0.8 } } });
    if (url.pathname === "/api/notifications") return json(route, { success: true, notifications: [] });
    if (url.pathname === "/api/workflow/contracts/template") return json(route, { success: true, template });
    if (url.pathname === "/api/workflow/contracts" && method === "GET") return json(route, { success: true, contracts: [] });
    if (url.pathname === "/api/workflow/clients" && method === "GET") return json(route, { success: true, clients: [client] });
    if (url.pathname === "/api/workflow/projects" && method === "GET") return json(route, { success: true, projects: [project] });
    if (url.pathname === "/api/workflow/projects" && method === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      return json(route, {
        success: true,
        message: "Project created successfully.",
        project: { id: "project-new", title: payload.title, client_id: payload.client_id },
      }, 201);
    }
    if (url.pathname === "/api/workflow/projects/project-new/contract-coverage" && method === "PATCH") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      options.onCoverage?.(payload);
      return json(route, { success: true, message: "Contract coverage recorded." });
    }

    return json(route, { success: true });
  });
}

async function expectHealthyButtons(page: Page) {
  const invalidNesting = page.locator("a button, button a, button button, a a");
  await expect(invalidNesting, "Interactive controls must not be nested.").toHaveCount(0);

  const undersizedTextButtons = await page.locator("button:visible").evaluateAll((buttons) =>
    buttons
      .map((button) => {
        const bounds = button.getBoundingClientRect();
        const style = window.getComputedStyle(button);
        return {
          height: Math.round(bounds.height),
          label: (button.textContent || "").replace(/\s+/g, " ").trim(),
          paddingLeft: Number.parseFloat(style.paddingLeft),
          paddingRight: Number.parseFloat(style.paddingRight),
        };
      })
      .filter((button) => button.label && (button.height < 32 || button.paddingLeft < 8 || button.paddingRight < 8)),
  );
  expect(undersizedTextButtons, `Undersized text buttons: ${JSON.stringify(undersizedTextButtons)}`).toEqual([]);
}

test.describe("contracts UX", () => {
  test("contract composer has padded actions, no nested controls, and a complete three-step flow", async ({ page }, testInfo) => {
    await mockWorkspace(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/workflow/contracts?new=1&clientId=client-1&projectId=project-1", { waitUntil: "domcontentloaded" });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Agreement title" })).toHaveValue(template.title);

    const continueButton = page.getByRole("button", { name: "Continue" });
    const primaryStyle = await continueButton.evaluate((button) => {
      const style = window.getComputedStyle(button);
      return {
        backgroundColor: style.backgroundColor,
        height: button.getBoundingClientRect().height,
        paddingLeft: Number.parseFloat(style.paddingLeft),
        paddingRight: Number.parseFloat(style.paddingRight),
      };
    });
    expect(primaryStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(primaryStyle.height).toBeGreaterThanOrEqual(39);
    expect(primaryStyle.paddingLeft).toBeGreaterThanOrEqual(16);
    expect(primaryStyle.paddingRight).toBeGreaterThanOrEqual(16);

    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1440);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
    await expectHealthyButtons(page);

    await continueButton.click();
    await expect(page.getByRole("heading", { name: "Customize the actual agreement" })).toBeVisible();
    await page.getByRole("button", { name: "Add custom clause" }).click();
    await expect(page.locator('input[value="Custom clause"]')).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Connect fees to invoice triggers" })).toBeVisible();
    await page.getByRole("button", { name: "Add milestones" }).click();
    await expect(page.getByRole("heading", { name: "Payment 1" })).toBeVisible();
    await expectHealthyButtons(page);

    await page.screenshot({ path: testInfo.outputPath("contracts-composer-desktop.png"), fullPage: true });
  });

  test("contract composer stays inside a mobile viewport", async ({ page }, testInfo) => {
    await mockWorkspace(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/workflow/contracts?new=1&clientId=client-1&projectId=project-1", { waitUntil: "domcontentloaded" });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Agreement title" })).toHaveValue(template.title);
    const dimensions = await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        bottom: bounds.bottom,
        height: bounds.height,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });
    expect(dimensions.left).toBeGreaterThanOrEqual(0);
    expect(dimensions.top).toBeGreaterThanOrEqual(0);
    expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.viewportHeight);
    const continueButton = page.getByRole("button", { name: "Continue" });
    await expect(continueButton).toBeVisible();
    const continueBounds = await continueButton.boundingBox();
    expect(continueBounds).not.toBeNull();
    expect(continueBounds!.y + continueBounds!.height).toBeLessThanOrEqual(dimensions.viewportHeight);
    await expectHealthyButtons(page);
    await page.screenshot({ path: testInfo.outputPath("contracts-composer-mobile.png") });
  });

  test("new projects immediately ask for an explicit contract decision", async ({ page }) => {
    let coveragePayload: Record<string, unknown> | undefined;
    await mockWorkspace(page, { onCoverage: (payload) => { coveragePayload = payload; } });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/workflow/projects", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Create new project" }).click();
    await page.getByPlaceholder("E.g. website redesign, mobile launch").fill("Brand launch");
    const drawer = page.locator("div.fixed.inset-0").filter({ hasText: "create new project" });
    await drawer.locator("select").first().selectOption(client.id);
    await page.getByRole("button", { name: "launch project" }).click();

    const decision = page.getByRole("dialog");
    await expect(decision.getByRole("heading", { name: "How is this project covered?" })).toBeVisible();
    await expect(decision.getByRole("button", { name: /Create a Rive contract/ })).toBeVisible();
    await expect(decision.getByRole("button", { name: /Handled elsewhere/ })).toBeVisible();
    await expect(decision.getByRole("button", { name: /No contract needed/ })).toBeVisible();
    await expect(decision.getByRole("button", { name: "Decide later" })).toBeVisible();

    await decision.getByRole("button", { name: /Handled elsewhere/ }).click();
    await decision.getByPlaceholder("Client MSA in Drive").fill("Signed client MSA");
    await decision.locator('input[type="url"]').fill("https://example.com/client-msa");
    await decision.getByRole("button", { name: "Save external record" }).click();

    await expect.poll(() => coveragePayload).toEqual({
      coverage: "external",
      externalLabel: "Signed client MSA",
      externalUrl: "https://example.com/client-msa",
    });
    await expect(decision).toBeHidden();
  });

  test("dashboard shell keeps navigation sticky and renders sidebar toggle icons", async ({ page }) => {
    await mockWorkspace(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/workflow/contracts", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Agreements" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Display currency").last()).toHaveValue("INR");
    await expect(page.getByText("Development signing mode")).toHaveCount(0);

    const shell = await page.evaluate(() => {
      const aside = document.querySelector("aside");
      const desktopBar = document.querySelector("div.hidden.md\\:flex");
      const main = document.querySelector("main");
      const toggle = document.querySelector('aside button[aria-label="Collapse sidebar"]');
      const icon = toggle?.querySelector("svg");
      return {
        asidePosition: aside ? getComputedStyle(aside).position : "",
        topBarPosition: desktopBar ? getComputedStyle(desktopBar).position : "",
        mainOverflowY: main ? getComputedStyle(main).overflowY : "",
        iconWidth: icon?.getBoundingClientRect().width || 0,
        iconHeight: icon?.getBoundingClientRect().height || 0,
      };
    });
    expect(shell.asidePosition).toBe("sticky");
    expect(shell.topBarPosition).toBe("sticky");
    expect(shell.mainOverflowY).toBe("auto");
    expect(shell.iconWidth).toBeGreaterThan(0);
    expect(shell.iconHeight).toBeGreaterThan(0);

    const collapseButton = page.getByRole("button", { name: "Collapse sidebar" });
    await expect(collapseButton).toHaveCount(1);
    await collapseButton.click();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toHaveCount(1);
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(page.getByRole("button", { name: "Collapse sidebar" })).toHaveCount(1);
  });
});
