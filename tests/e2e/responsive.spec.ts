import { expect, test } from "@playwright/test";

const responsiveRoutes = ["/", "/login", "/register", "/contact", "/changelog"];
const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

for (const route of responsiveRoutes) {
  for (const viewport of viewports) {
    test(`${route} has no page-level overflow at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });

      expect(response?.status()).toBeLessThan(500);
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(
        dimensions.scrollWidth,
        `${route} overflows by ${dimensions.scrollWidth - dimensions.clientWidth}px at ${viewport.width}px`,
      ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    });
  }
}
