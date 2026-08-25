import { expect, test, type Page, type Route } from "@playwright/test";

async function installMarketingMocks(page: Page) {
  await page.route("**/api/rates", async (route: Route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data: { base: "USD", date: "2026-08-10", rates: { USD: 1, INR: 83, EUR: 0.9 } } }),
  }));
}

test.describe("marketing responsive guardrails", () => {
  test("Remit keeps its story and calculator side by side on desktop", async ({ page }) => {
    await installMarketingMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#remit", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("remit-section")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Know the payout before you send it." })).toHaveCount(0);
    await expect(page.getByText("international payouts", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Preview the conversion. Nothing moves yet." })).toBeVisible();
    await expect(page.getByText("Preview only. Not a transfer.").first()).toBeVisible();
    await expect(page.getByText("No money moves yet.")).toBeVisible();
    await expect(page.getByText("They receive")).toHaveCount(0);
    await expect(page.getByText("You send", { exact: true })).toHaveCount(0);
    await expect(page.getByText("From", { exact: true })).toBeVisible();
    await expect(page.getByText("To", { exact: true })).toBeVisible();

    const geometry = await page.evaluate(() => {
      const story = document.querySelector<HTMLElement>('[data-testid="remit-story"]')?.getBoundingClientRect();
      const calculator = document.querySelector<HTMLElement>('[data-testid="remit-calculator"]')?.getBoundingClientRect();
      return story && calculator
        ? { storyLeft: story.left, storyTop: story.top, storyWidth: story.width, calculatorLeft: calculator.left, calculatorTop: calculator.top, calculatorWidth: calculator.width, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), clientWidth: document.documentElement.clientWidth }
        : null;
    });

    expect(geometry).not.toBeNull();
    expect(geometry!.calculatorLeft).toBeGreaterThan(geometry!.storyLeft + geometry!.storyWidth / 2);
    expect(Math.abs(geometry!.calculatorTop - geometry!.storyTop)).toBeLessThan(100);
    expect(geometry!.calculatorWidth).toBeGreaterThan(400);
    expect(geometry!.scrollWidth).toBeLessThanOrEqual(geometry!.clientWidth + 1);
  });

  test("Remit stacks without overflow on mobile", async ({ page }) => {
    await installMarketingMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#remit", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("remit-section")).toBeVisible();
    await expect(page.getByTestId("remit-promise")).toHaveCount(3);

    const geometry = await page.evaluate(() => {
      const story = document.querySelector<HTMLElement>('[data-testid="remit-story"]')?.getBoundingClientRect();
      const calculator = document.querySelector<HTMLElement>('[data-testid="remit-calculator"]')?.getBoundingClientRect();
      return story && calculator
        ? { storyBottom: story.bottom, calculatorTop: calculator.top, calculatorWidth: calculator.width, clientWidth: document.documentElement.clientWidth, scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) }
        : null;
    });

    expect(geometry).not.toBeNull();
    expect(geometry!.calculatorTop).toBeGreaterThanOrEqual(geometry!.storyBottom);
    expect(geometry!.calculatorWidth).toBeLessThanOrEqual(geometry!.clientWidth - 32);
    expect(geometry!.scrollWidth).toBeLessThanOrEqual(geometry!.clientWidth + 1);
  });

  test("marketing keeps the complete product structure", async ({ page }) => {
    await installMarketingMocks(page);
    await page.goto("/#faq", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("marketing-agreements-section")).toBeVisible();
    await expect(page.getByText("Contract to cash", { exact: true })).toBeVisible();
    await expect(page.getByTestId("faq-grid").locator("h3")).toHaveCount(6);
    await expect(page.getByRole("heading", { name: "Can I bring my existing data into rive.?" })).toBeVisible();
  });
});
