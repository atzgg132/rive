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
});
