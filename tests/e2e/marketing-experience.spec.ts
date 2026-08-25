import { expect, test, type Page } from "@playwright/test";

type CssColor = { r: number; g: number; b: number; a: number };

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  return errors;
}

function parseCssColor(input: string): CssColor {
  if (!input || input === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const values = (input.match(/[\d.]+/g) || []).map(Number);
  return {
    r: values[0] ?? 0,
    g: values[1] ?? 0,
    b: values[2] ?? 0,
    a: values.length >= 4 ? values[3]! : 1,
  };
}

function relativeLuminance({ r, g, b }: CssColor) {
  const toLinear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return toLinear(r) * 0.2126 + toLinear(g) * 0.7152 + toLinear(b) * 0.0722;
}

function contrastRatio(foreground: CssColor, background: CssColor) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

async function openHomeWithColorTheme(page: Page, theme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem("rive-color-theme", selectedTheme);
  }, theme);
  await page.goto("/", { waitUntil: "load" });
  if (theme === "dark") {
    await expect(page.locator("html")).toHaveClass(/dark/);
  } else {
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  }
}

test.describe("marketing experience", () => {
  test("scrollytelling keeps stacked in-flow chapters readable without a sticky rail", async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#product", { waitUntil: "load" });

    const scrolly = page.getByTestId("scrollytelling-section");
    const chapters = page.locator("[data-chapter-index]");
    await expect(scrolly).toBeVisible();
    await expect(page.getByTestId("scrollytelling-rail")).toHaveCount(0);
    await expect(chapters).toHaveCount(7);
    await expect(chapters.nth(0).getByTestId("problem-disconnection")).toHaveCount(1);

    for (let index = 1; index < 7; index += 1) {
      const chapter = chapters.nth(index);
      await chapter.scrollIntoViewIfNeeded();
      await expect(chapter.locator("[data-product-frame]"), `chapter ${index} keeps its product visual in flow`).toHaveCount(1);
    }

    const opacities = await chapters.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).opacity));
    expect(opacities).toEqual(Array(7).fill("1"));
    const sticky = await scrolly.evaluate((node) => [node, ...node.querySelectorAll("*")].some((el) => getComputedStyle(el).position === "sticky"));
    expect(sticky).toBe(false);
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

  // SHIP-GATE ONLY: 1920×1080 @ 150% Windows ≈ 1280×720 CSS, and 1920×1200 @ 150% ≈ 1280×800.
  // Do not add 1366×768 or 1440×900 to this loop. Those already fit at 100%.
  // Do not assert which pipeline node is active — interval autoplay may already be on WORK.
  const heroStageLabels = ["CLIENT", "WORK", "AGREEMENT", "INVOICE", "PROOF"] as const;

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1280, height: 800 },
  ]) {
    test(`the hero and pipeline fit a ${viewport.width}×${viewport.height} 150% scale laptop at rest`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.setViewportSize(viewport);
      await page.goto("/", { waitUntil: "load" });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      const hero = page.getByTestId("marketing-hero");
      const pipeline = page.getByTestId("hero-pipeline");
      await expect(hero.locator("h1")).toBeVisible();
      await expect(hero.getByRole("link", { name: "Build your workspace", exact: true })).toBeVisible();
      await expect(hero.getByRole("link", { name: "See the unpaid role", exact: true })).toBeVisible();
      await expect(pipeline).toBeVisible();

      for (const label of heroStageLabels) {
        await expect(pipeline.getByText(label, { exact: true })).toBeVisible();
        await expect(pipeline.locator(`[data-hero-stage-label="${label}"]`)).toBeVisible();
      }
      await expect(pipeline.getByText("The relationship", { exact: true })).toBeVisible();
      const shortDisplay = await pipeline.locator("[data-hero-stage-short]").evaluateAll((nodes) =>
        nodes.map((node) => getComputedStyle(node).display),
      );
      expect(shortDisplay.length, `${viewport.width}×${viewport.height} missing stage shorts`).toBe(5);
      expect(
        shortDisplay.every((display) => display !== "none"),
        `${viewport.width}×${viewport.height} stage shorts are display:none`,
      ).toBe(true);

      const geometry = await page.evaluate((stageLabels) => {
        const heroNode = document.querySelector("[data-testid='marketing-hero']");
        const header = document.querySelector("[data-testid='site-header']");
        const headline = heroNode?.querySelector("h1");
        const pipelineNode = document.querySelector("[data-testid='hero-pipeline']");
        const primary = heroNode?.querySelector("a[href='/register']");
        const secondary = heroNode?.querySelector("a[href='#problem']");
        const chips = heroNode
          ? Array.from(heroNode.querySelectorAll("span")).filter((node) => /open signup|free during beta|your data stays yours/i.test(node.textContent || ""))
          : [];
        if (!headline || !pipelineNode || !primary || !secondary || chips.length < 3) return null;
        const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
        const headlineRect = headline.getBoundingClientRect();
        const pipelineRect = pipelineNode.getBoundingClientRect();
        const primaryRect = primary.getBoundingClientRect();
        const secondaryRect = secondary.getBoundingClientRect();
        const inFirstScreen = (rect: DOMRect) => rect.top >= headerBottom - 1 && rect.bottom <= window.innerHeight + 1;
        const labels = stageLabels.map((label) => {
          const node = pipelineNode.querySelector(`[data-hero-stage-label="${label}"]`)
            || Array.from(pipelineNode.querySelectorAll("span")).find((el) => el.textContent?.trim() === label && el.children.length === 0)
            || null;
          if (!node) return { label, found: false as const, display: "missing", visibility: "missing", top: 0, bottom: 0, inFirstScreen: false };
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return {
            label,
            found: true as const,
            display: style.display,
            visibility: style.visibility,
            top: rect.top,
            bottom: rect.bottom,
            inFirstScreen: inFirstScreen(rect),
          };
        });
        return {
          scrollY: window.scrollY,
          headerBottom,
          innerHeight: window.innerHeight,
          headlineTop: headlineRect.top,
          headlineBottom: headlineRect.bottom,
          primaryTop: primaryRect.top,
          primaryBottom: primaryRect.bottom,
          secondaryBottom: secondaryRect.bottom,
          pipelineTop: pipelineRect.top,
          pipelineBottom: pipelineRect.bottom,
          headlineFits: inFirstScreen(headlineRect),
          primaryFits: inFirstScreen(primaryRect),
          secondaryFits: inFirstScreen(secondaryRect),
          pipelineFits: inFirstScreen(pipelineRect),
          chipsFit: chips.every((chip) => inFirstScreen(chip.getBoundingClientRect())),
          labels,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      }, [...heroStageLabels]);

      expect(geometry, `${viewport.width}×${viewport.height} missing hero geometry`).not.toBeNull();
      expect(geometry!.scrollY).toBe(0);
      expect(geometry!.headlineTop).toBeGreaterThanOrEqual(geometry!.headerBottom - 1);
      expect(geometry!.headlineBottom).toBeLessThanOrEqual(geometry!.innerHeight + 1);
      expect(geometry!.headlineFits, `${viewport.width}×${viewport.height} headline clipped`).toBe(true);
      expect(geometry!.primaryTop).toBeGreaterThanOrEqual(0);
      expect(geometry!.primaryBottom).toBeLessThanOrEqual(geometry!.innerHeight + 1);
      expect(geometry!.primaryFits, `${viewport.width}×${viewport.height} primary CTA clipped`).toBe(true);
      expect(geometry!.secondaryFits, `${viewport.width}×${viewport.height} secondary CTA clipped`).toBe(true);
      expect(geometry!.pipelineTop).toBeGreaterThanOrEqual(0);
      expect(geometry!.pipelineBottom, `${viewport.width}×${viewport.height} pipeline overflows viewport`).toBeLessThanOrEqual(geometry!.innerHeight + 1);
      expect(geometry!.pipelineFits, `${viewport.width}×${viewport.height} pipeline clipped`).toBe(true);
      expect(geometry!.chipsFit, `${viewport.width}×${viewport.height} proof chips clipped`).toBe(true);
      expect(geometry!.overflow).toBe(false);
      expect(geometry!.labels).toHaveLength(heroStageLabels.length);
      for (const row of geometry!.labels) {
        expect(row.found, `${viewport.width}×${viewport.height} missing ${row.label}`).toBe(true);
        expect(row.display, `${viewport.width}×${viewport.height} ${row.label} display`).not.toBe("none");
        expect(row.visibility, `${viewport.width}×${viewport.height} ${row.label} visibility`).not.toBe("hidden");
        expect(row.top, `${viewport.width}×${viewport.height} ${row.label} above header`).toBeGreaterThanOrEqual(geometry!.headerBottom - 1);
        expect(row.bottom, `${viewport.width}×${viewport.height} ${row.label} below viewport`).toBeLessThanOrEqual(geometry!.innerHeight + 1);
        expect(row.inFirstScreen, `${viewport.width}×${viewport.height} ${row.label} clipped`).toBe(true);
      }
    });
  }

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
    await expect(problem.getByTestId("problem-disconnection")).toBeVisible();
  });

  test("the problem beat stacks into the connected loop without a sticky cut", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "load" });
    const stage = page.getByTestId("marketing-problem");
    await expect(stage).toBeVisible();
    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(desktopOverflow).toBe(false);

    await page.locator("#problem").evaluate((node) => node.scrollIntoView({ block: "start" }));
    await expect(page.getByTestId("scrollytelling-rail")).toHaveCount(0);
    await expect(stage.getByTestId("problem-disconnection")).toBeVisible();

    const solution = page.locator('[data-chapter-index="1"]');
    await solution.evaluate((node) => node.scrollIntoView({ block: "start" }));
    await expect(solution.getByRole("heading", { name: "Change one thing. Everything downstream already knows." })).toBeVisible();
    await expect(solution.locator("[data-product-frame]")).toHaveCount(1);

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

  test("marketing body copy meets WCAG AA contrast", async ({ page }) => {
    for (const theme of ["light", "dark"] as const) {
      await openHomeWithColorTheme(page, theme);
      const samples = await page.locator("h1 + p").evaluate((node) => {
        const style = getComputedStyle(node);
        const surface = document.querySelector('[data-surface="marketing"]');
        return {
          color: style.color,
          background: style.backgroundColor,
          surfaceBackground: surface ? getComputedStyle(surface).backgroundColor : "",
        };
      });
      const color = parseCssColor(samples.color);
      const ownBackground = parseCssColor(samples.background);
      const background = ownBackground.a === 0
        ? parseCssColor(samples.surfaceBackground)
        : ownBackground;
      const paintedBackground = ownBackground.a === 0 ? samples.surfaceBackground : samples.background;
      expect(
        contrastRatio(color, background),
        `${theme} hero body contrast using color ${samples.color} on ${paintedBackground}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("the primary hero action has an accessible name", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("main").getByRole("link", { name: "Build your workspace", exact: true })).toBeVisible();
  });

  test("the navbar signup action uses the marketing glass surface", async ({ page }) => {
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.addInitScript((selectedTheme) => {
        window.localStorage.setItem("rive-color-theme", selectedTheme);
      }, theme);

      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/", { waitUntil: "load" });
        if (theme === "dark") {
          await expect(page.locator("html")).toHaveClass(/dark/);
        } else {
          await expect(page.locator("html")).not.toHaveClass(/dark/);
        }

        const header = page.getByTestId("site-header");
        if (width < 768) await header.getByRole("button", { name: "Open navigation" }).click();

        const signup = header.getByRole("link", { name: "Build your workspace", exact: true });
        await expect(signup).toBeVisible();
        const surface = await signup.evaluate((node) => {
          const style = getComputedStyle(node);
          const animatedBorder = getComputedStyle(node, "::before");
          return {
            background: style.backgroundColor,
            color: style.color,
            animationDuration: animatedBorder.animationDuration,
            animationName: animatedBorder.animationName,
          };
        });

        expect(surface.animationName).toBe("marketingBorderSpin");
        expect(surface.animationDuration).toBe("16s");

        const background = parseCssColor(surface.background);
        const color = parseCssColor(surface.color);
        const glassOrLargeText = background.a < 1 || contrastRatio(color, background) >= 3;
        expect(
          glassOrLargeText,
          `${theme} header CTA should stay translucent or meet 3:1 large-text contrast (background ${surface.background}, color ${surface.color})`,
        ).toBe(true);

        if (theme === "dark") {
          expect(relativeLuminance(color), "dark header CTA text should stay light").toBeGreaterThan(0.5);
        } else {
          expect(relativeLuminance(color), "light header CTA text should stay dark").toBeLessThan(0.4);
        }
      }
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
    let payload: Record<string, string | number> | null = null;
    await page.route("**/api/contact", async (route) => {
      payload = route.request().postDataJSON() as Record<string, string | number>;
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
      website: "",
      startedAt: expect.any(Number),
    });
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("scrolly headings are in the HTML and visible without JavaScript", async ({ page }) => {
      const problemHeading = "There is an unpaid role inside every independent business.";
      const chapterHeading = "Change one thing. Everything downstream already knows.";

      await page.goto("/", { waitUntil: "domcontentloaded" });

      const problem = page.getByRole("heading", { name: problemHeading });
      const chapter = page.locator('[data-chapter-index="1"]').getByRole("heading", { name: chapterHeading });
      await expect(problem).toBeVisible();
      await expect(chapter).toBeVisible();
      expect((await problem.innerText()).trim()).toBe(problemHeading);
      expect((await chapter.innerText()).trim()).toBe(chapterHeading);

      const html = await page.content();
      expect(html).toContain(problemHeading);
      expect(html).toContain(chapterHeading);

      await expect(page.getByTestId("scrollytelling-rail")).toHaveCount(0);
      await expect(page.getByText("Know the payout before you send it.")).toHaveCount(0);
    });
  });
});
