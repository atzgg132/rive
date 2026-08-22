import { expect, test, type Page } from "@playwright/test";

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  return errors;
}

test.describe("marketing experience", () => {
  test("scrollytelling activates the chapter at scroll depth and the visual rail sticks", async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#product", { waitUntil: "load" });

    const scrolly = page.getByTestId("scrollytelling-section");
    const rail = page.getByTestId("scrollytelling-rail");
    await expect(scrolly).toBeVisible();
    await expect(rail).toBeVisible();
    await expect(scrolly.locator("[data-product-frame]")).toHaveCount(1);
    await page.waitForFunction(() => getComputedStyle(document.querySelector<HTMLElement>('[data-chapter-index="1"]')!).opacity === "0.3");

    const target = page.locator('[data-chapter-index="3"]');
    await target.evaluate((node) => {
      const top = window.scrollY + node.getBoundingClientRect().top - window.innerHeight * 0.38;
      window.scrollTo(0, top);
    });
    await expect(target).toHaveAttribute("data-active", "true");

    const sticky = await rail.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { position: getComputedStyle(node).position, top: rect.top };
    });
    expect(sticky.position).toBe("sticky");
    expect(Math.abs(sticky.top)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test("reduced motion keeps every chapter and product visual reachable without the sticky rail", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#product", { waitUntil: "load" });

    const chapters = page.locator("[data-chapter-index]");
    await expect(chapters).toHaveCount(6);
    await expect(page.getByTestId("scrollytelling-rail")).toHaveCount(0);
    for (let index = 0; index < 6; index += 1) {
      const chapter = chapters.nth(index);
      await chapter.scrollIntoViewIfNeeded();
      await expect(chapter.locator("[data-product-frame]"), `chapter ${index + 1} keeps its product visual reachable`).toHaveCount(1);
    }
    const opacities = await chapters.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).opacity));
    expect(opacities).toEqual(Array(6).fill("1"));
  });

  test("reduced motion presents every command-palette result without a stagger delay", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "load" });

    await expect(page.getByText("Northstar Labs · Product redesign · Paid", { exact: true })).toBeVisible();
    await expect(page.getByText("Atlas Studio · Research sprint · Sent", { exact: true })).toBeVisible();
  });

  test("marketing headings form a valid outline", async ({ page }) => {
    for (const route of ["/", "/about", "/contact", "/docs", "/guides", "/privacy"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const outline = await page.locator("h1, h2, h3, h4, h5, h6").evaluateAll((nodes) => nodes
        .filter((node) => {
          const style = getComputedStyle(node);
          return style.display !== "none" && style.visibility !== "hidden";
        })
        .map((node) => ({ level: Number(node.tagName.slice(1)), text: node.textContent?.trim() || "" })));
      expect(outline.filter((heading) => heading.level === 1), `${route} needs one h1`).toHaveLength(1);
      for (let index = 1; index < outline.length; index += 1) {
        expect(
          outline[index].level,
          `${route} skips from h${outline[index - 1].level} to h${outline[index].level}: ${outline[index].text}`,
        ).toBeLessThanOrEqual(outline[index - 1].level + 1);
      }
    }
  });

  test("visible marketing controls expose a keyboard focus ring", async ({ page }) => {
    for (const route of ["/", "/contact"]) {
      await page.goto(route, { waitUntil: "load" });
      const count = await page.evaluate(() => {
        const controls = Array.from(document.querySelectorAll<HTMLElement>("a, button, input, select, textarea"));
        const visible = controls.filter((control) => {
          const rect = control.getBoundingClientRect();
          const style = getComputedStyle(control);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        });
        visible.forEach((control, index) => control.dataset.focusTest = String(index));
        return visible.length;
      });
      await page.keyboard.press("Tab");
      for (let index = 0; index < count; index += 1) {
        const control = page.locator(`[data-focus-test="${index}"]`);
        await control.focus();
        const ring = await control.evaluate((node) => {
          const style = getComputedStyle(node);
          return { width: Number.parseFloat(style.outlineWidth), style: style.outlineStyle };
        });
        expect(ring.style, `${route} control ${index} has no visible focus style`).not.toBe("none");
        expect(ring.width, `${route} control ${index} has no visible focus width`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test("dark-surface body copy meets WCAG AA contrast", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const contrast = await page.locator("h1 + p").evaluate((node) => {
      function rgb(input: string) {
        return (input.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      }
      function luminance([r, g, b]: number[]) {
        const values = [r, g, b].map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
        });
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
      }
      const foreground = luminance(rgb(getComputedStyle(node).color));
      const background = luminance([5, 7, 12]);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });

  test("the primary hero action has an accessible name", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("main").getByRole("link", { name: "Build your workspace", exact: true })).toBeVisible();
  });

  test("contact form keeps the live API contract", async ({ page }) => {
    let payload: Record<string, string> | null = null;
    await page.route("**/api/contact", async (route) => {
      payload = route.request().postDataJSON() as Record<string, string>;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    });
    await page.goto("/contact", { waitUntil: "load" });
    await page.getByLabel("Name").fill("Maya Rao");
    await page.getByLabel("Email").fill("maya@example.com");
    await page.getByLabel("Subject").selectOption("Bug Report");
    await page.getByLabel("Message").fill("The client handoff lost its project context.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("heading", { name: "Message received." })).toBeVisible();
    expect(payload).toEqual({
      name: "Maya Rao",
      email: "maya@example.com",
      subject: "Bug Report",
      message: "The client handoff lost its project context.",
    });
  });
});
