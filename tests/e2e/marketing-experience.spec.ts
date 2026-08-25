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
    await expect(rail.getByTestId("problem-disconnection")).toBeVisible();
    await page.waitForFunction(() => getComputedStyle(document.querySelector<HTMLElement>('[data-chapter-index="1"]')!).opacity === "0.3");

    const target = page.locator('[data-chapter-index="3"]');
    await target.evaluate((node) => node.scrollIntoView({ block: "start" }));
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
    await expect(chapters).toHaveCount(7);
    await expect(page.getByTestId("scrollytelling-rail")).toHaveCount(0);
    await expect(chapters.nth(0).getByTestId("problem-disconnection")).toHaveCount(1);
    for (let index = 1; index < 7; index += 1) {
      const chapter = chapters.nth(index);
      await chapter.scrollIntoViewIfNeeded();
      await expect(chapter.locator("[data-product-frame]"), `chapter ${index} keeps its product visual reachable`).toHaveCount(1);
    }
    const opacities = await chapters.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).opacity));
    expect(opacities).toEqual(Array(7).fill("1"));
  });

  test("the hero leads with type and a data-neutral pipeline", async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "load" });

    const hero = page.getByTestId("marketing-hero");
    await expect(hero).toBeVisible();
    await expect(page.getByTestId("continuity-object")).toHaveCount(0);
    await expect(page.getByTestId("context-stack")).toHaveCount(0);
    await expect(page.getByTestId("connected-context-relay")).toHaveCount(0);
    await expect(page.locator(".continuity-loop-anchor")).toHaveCount(0);
    await expect(page.getByPlaceholder("Search clients, projects, or invoices…")).toHaveCount(0);
    await expect(hero.locator("h1")).toBeVisible();

    const primary = hero.getByRole("link", { name: "Build your workspace", exact: true });
    await expect(primary).toBeVisible();
    const ctaInView = await primary.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    });
    expect(ctaInView).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    const geometry = await hero.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        viewport: document.documentElement.clientWidth,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewport);
    expect(geometry.overflow).toBe(false);
    await expect(hero.getByRole("link", { name: "Build your workspace", exact: true })).toBeVisible();

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.getByTestId("continuity-object")).toHaveCount(0);
    expect(errors).toEqual([]);
    await page.emulateMedia({ reducedMotion: "no-preference" });
  });

  test("the hero pipeline is interactive, truthful, and visible on mobile", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "load" });

    const pipeline = page.getByTestId("hero-pipeline");
    await expect(pipeline).toBeVisible();
    await expect(pipeline.getByTestId(/hero-stage-/)).toHaveCount(5);
    await expect(pipeline).not.toContainText(/Northstar|Product redesign|INV-|₹|USD|INR/);

    await pipeline.getByTestId("hero-stage-proof").click();
    await expect(pipeline).toContainText("Selected projects can become public portfolio proof");
    await expect(pipeline.getByTestId("hero-stage-proof")).toHaveAttribute("aria-pressed", "true");
    await expect(pipeline.getByTestId("hero-stage-client")).toHaveAttribute("aria-pressed", "false");

    await pipeline.getByTestId("hero-stage-client").click();
    await expect(pipeline.getByTestId("hero-stage-client")).toHaveAttribute("aria-pressed", "true");
    await expect(pipeline.getByTestId("hero-stage-proof")).toHaveAttribute("aria-pressed", "false");

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileGeometry = await pipeline.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        top: rect.top,
        visibleInFirstViewport: rect.top < window.innerHeight,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    expect(mobileGeometry.visibleInFirstViewport).toBe(true);
    expect(mobileGeometry.overflow).toBe(false);
  });

  test("the hero secondary CTA scrolls to the problem before the connected loop", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "load" });

    const problem = page.getByTestId("marketing-problem");
    await expect(page.getByRole("link", { name: "See the unpaid role", exact: true })).toBeVisible();
    await expect(problem).toBeVisible();
    await expect(page.locator("#product")).toBeVisible();

    const order = await page.evaluate(() => {
      const hero = document.querySelector("[data-testid='marketing-hero']");
      const problemNode = document.querySelector("[data-testid='marketing-problem']");
      const loopNode = document.querySelector('[data-chapter-index="1"]');
      if (!hero || !problemNode || !loopNode) return null;
      return {
        problemFollowsHero: Boolean(hero.compareDocumentPosition(problemNode) & Node.DOCUMENT_POSITION_FOLLOWING),
        loopFollowsProblem: Boolean(problemNode.compareDocumentPosition(loopNode) & Node.DOCUMENT_POSITION_FOLLOWING),
      };
    });
    expect(order?.problemFollowsHero).toBe(true);
    expect(order?.loopFollowsProblem).toBe(true);

    await page.getByRole("link", { name: "See the unpaid role", exact: true }).click();
    await expect.poll(async () => problem.evaluate((node) => Math.abs(node.getBoundingClientRect().top))).toBeLessThan(8);
    await expect(problem.getByRole("heading", { name: "There is an unpaid role inside every independent business." })).toBeVisible();
    await expect(page.getByTestId("scrollytelling-rail")).toBeVisible();
    await expect(page.getByTestId("scrollytelling-rail").getByTestId("problem-disconnection")).toBeVisible();
    const solutionTop = await page.locator('[data-chapter-index="1"]').evaluate((node) => node.getBoundingClientRect().top);
    expect(solutionTop).toBeGreaterThan(500);
  });

  test("the problem beat fills the first viewport and hands off into the connected loop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "load" });
    const stage = page.getByTestId("marketing-problem");
    const geometry = await stage.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { height: rect.height, top: rect.top, viewport: window.innerHeight, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    expect(geometry.height).toBeGreaterThanOrEqual(geometry.viewport - 2);
    expect(geometry.overflow).toBe(false);

    const rail = page.getByTestId("scrollytelling-rail");
    await page.locator("#problem").evaluate((node) => node.scrollIntoView({ block: "start" }));
    await expect(rail.getByTestId("problem-disconnection")).toBeVisible();
    await expect(rail.locator("[data-product-frame]")).toHaveCount(0);

    const solution = page.locator('[data-chapter-index="1"]');
    await solution.evaluate((node) => node.scrollIntoView({ block: "start" }));
    await expect(solution).toHaveAttribute("data-active", "true");
    await expect(solution.getByRole("heading", { name: "Change one thing. Everything downstream already knows." })).toBeVisible();
    await expect.poll(async () => ({
      product: await rail.locator("[data-product-frame]").count(),
      problem: await rail.getByTestId("problem-disconnection").count(),
    })).toEqual({ product: 1, problem: 0 });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "load" });
    await expect(page.getByTestId("marketing-problem")).toBeVisible();
    await expect(page.getByTestId("marketing-problem").getByTestId("problem-disconnection")).toBeVisible();
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(mobileOverflow).toBe(false);
  });

  test("brand fonts are preloaded and stable after first paint", async ({ page }) => {
    const fontRequests: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "font") fontRequests.push(new URL(request.url()).pathname);
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    const preloadLinks = page.locator('head link[rel="preload"][as="font"]');
    await expect(preloadLinks).toHaveCount(2);

    const preloads = await preloadLinks.evaluateAll((links) =>
      links.map((link) => ({
        href: new URL((link as HTMLLinkElement).href).pathname,
        type: (link as HTMLLinkElement).type,
        crossOrigin: (link as HTMLLinkElement).crossOrigin,
      })),
    );
    expect(preloads).toEqual([
      { href: "/fonts/outfit-marketing.woff2", type: "font/woff2", crossOrigin: "anonymous" },
      { href: "/fonts/jetbrains-mono-marketing.woff2", type: "font/woff2", crossOrigin: "anonymous" },
    ]);

    const hero = page.locator("h1").first();
    await expect(hero).toBeVisible();
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    const firstPaint = await hero.evaluate((node) => ({
      family: getComputedStyle(node).fontFamily,
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
    }));

    await page.evaluate(() => document.fonts.ready);
    const settled = await hero.evaluate((node) => ({
      family: getComputedStyle(node).fontFamily,
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
    }));

    expect(firstPaint.family).toBe('Outfit, system-ui, sans-serif');
    expect(settled.family).toBe(firstPaint.family);
    expect(Math.abs(settled.width - firstPaint.width)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(settled.height - firstPaint.height)).toBeLessThanOrEqual(0.5);
    expect(fontRequests).toEqual(expect.arrayContaining([
      "/fonts/outfit-marketing.woff2",
      "/fonts/jetbrains-mono-marketing.woff2",
    ]));
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

  test("the navbar signup action uses the marketing glass surface", async ({ page }) => {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/", { waitUntil: "load" });
      const header = page.getByTestId("site-header");
      if (width < 768) await header.getByRole("button", { name: "Open navigation" }).click();

      const signup = header.getByRole("link", { name: "Build your workspace", exact: true });
      await expect(signup).toBeVisible();
      const surface = await signup.evaluate((node) => {
        const style = getComputedStyle(node);
        const animatedBorder = getComputedStyle(node, "::before");
        return {
          background: style.backgroundColor,
          border: style.borderColor,
          color: style.color,
          animationDuration: animatedBorder.animationDuration,
          animationName: animatedBorder.animationName,
        };
      });

      expect(surface).toEqual({
        background: "rgba(96, 165, 250, 0.09)",
        border: "rgba(147, 197, 253, 0.25)",
        color: "rgb(239, 246, 255)",
        animationDuration: "16s",
        animationName: "marketingBorderSpin",
      });
    }

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "load" });
    const reducedMotionCta = page.getByTestId("site-header").getByRole("link", { name: "Build your workspace", exact: true });
    await expect(reducedMotionCta).toBeVisible();
    await expect(reducedMotionCta.evaluate((node) => getComputedStyle(node, "::before").animationName)).resolves.toBe("none");
  });

  test("the navbar stays optically centered without crowding tablet or mobile layouts", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const header = page.getByTestId("site-header");
      const primaryNav = header.getByRole("navigation", { name: "Primary navigation" });
      const menuButton = header.getByRole("button", { name: "Open navigation" });

      if (width < 1024) {
        await expect(primaryNav).toBeHidden();
        await expect(menuButton).toBeVisible();
      } else {
        await expect(primaryNav).toBeVisible();
        await expect(menuButton).toBeHidden();
        const centerDelta = await primaryNav.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return rect.x + rect.width / 2 - window.innerWidth / 2;
        });
        expect(centerDelta).toBe(-4);
      }

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);
    }
  });

  test("the header and footer wordmarks use a restrained motion-safe brand signal", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const logoDots = page.locator(".rive-logo-dot");
    await expect(logoDots).toHaveCount(2);
    for (const logoDot of await logoDots.all()) {
      await expect(logoDot).toHaveCSS("animation-name", "riveLogoSignal");
      await expect(logoDot).toHaveCSS("animation-duration", "14s");
    }

    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const logoDot of await logoDots.all()) {
      await expect(logoDot).toHaveCSS("animation-name", "none");
    }
  });

  test("the hero signal field connects, responds to scroll, and simplifies accessibly", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const field = page.getByTestId("connected-signal-field");
    const network = field.locator(".connected-signal-network");
    const rail = field.locator(".connected-signal-rail");
    const pulse = field.locator(".connected-signal-pulse").first();

    await expect(field).toBeVisible();
    await expect(field.locator(".connected-signal-node")).toHaveCount(19);
    await expect(field.locator(".connected-signal-pulse")).toHaveCount(3);
    await expect(pulse).toHaveCSS("animation-name", "connectedSignalTravel");
    await expect.poll(() => rail.evaluate((node) => node.style.opacity)).not.toBe("");
    const initialTransform = await network.getAttribute("style");
    const initialRailOpacity = Number.parseFloat(await rail.evaluate((node) => node.style.opacity));

    await page.evaluate(() => window.scrollTo(0, Math.round(window.innerHeight * 0.62)));
    await expect.poll(() => network.getAttribute("style")).not.toBe(initialTransform);
    const scrolledRailOpacity = Number.parseFloat(await rail.evaluate((node) => node.style.opacity));
    expect(scrolledRailOpacity).toBeGreaterThan(initialRailOpacity);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(field.locator(".signal-detail").first()).toHaveCSS("display", "none");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(pulse).toHaveCSS("animation-name", "none");
  });

  test("the hero presents beta status without duplicating the lifecycle narrative", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const hero = page.locator("main section").first();
    await expect(hero.getByText("OPEN BETA", { exact: true })).toBeVisible();
    await expect(hero.getByText("OPEN BETA · CLIENT → WORK → MONEY → PROOF", { exact: true })).toHaveCount(0);
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
