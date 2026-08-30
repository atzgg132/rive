import { expect, test, type Locator, type Page } from "@playwright/test";

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

/** Full-viewport sticky/fixed overlay covering the page. The chapter scene is a
 *  sticky column, not a page shutter — do not skip it here. */
async function coveringStickyShutter(page: Page) {
  return page.evaluate(() => {
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    return Array.from(document.querySelectorAll<HTMLElement>("body *")).flatMap((el) => {
      const testid = el.getAttribute("data-testid");
      if (testid === "site-header") return [];
      const style = getComputedStyle(el);
      if (style.position !== "sticky" && style.position !== "fixed") return [];
      if (style.pointerEvents === "none" || style.visibility === "hidden" || style.display === "none") return [];
      const rect = el.getBoundingClientRect();
      const coversWidth = rect.width >= viewportW * 0.92;
      const coversHeight = rect.height >= viewportH * 0.92;
      if (!coversWidth || !coversHeight) return [];
      return [{ testid, width: rect.width, height: rect.height, position: style.position }];
    });
  });
}

function viewportMinHeight(value: string) {
  return /^(100vh|100svh|100dvh|100lvh)$/.test(value.trim());
}

function isSeventyVhMinHeight(value: string, viewportHeight: number) {
  if (/\b70vh\b/.test(value.trim())) return true;
  const px = Number.parseFloat(value);
  if (!Number.isFinite(px) || px === 0) return false;
  return Math.abs(px - viewportHeight * 0.7) < 1;
}

/** Inner mock rows must not stay at opacity 0 — chrome alone is not a pass. */
async function stuckHiddenRows(scene: Locator) {
  return scene.evaluate((node) => {
    const root = node.querySelector<HTMLElement>("[data-product-frame], [data-testid='problem-disconnection']");
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>("*")).flatMap((el) => {
      const style = getComputedStyle(el);
      if (style.opacity !== "0" || style.display === "none" || style.visibility === "hidden") return [];
      if (el.getClientRects().length === 0) return [];
      return [el.textContent?.replace(/\s+/g, " ").trim().slice(0, 48) || el.tagName];
    });
  });
}

const RAIL_INNER_COPY: { index: number; copy: string[] }[] = [
  { index: 0, copy: ["Northstar Labs", "Contacts app", "No project attached"] },
  { index: 1, copy: ["Revenue collected", "Invoice INV-1042 paid"] },
  { index: 2, copy: ["Scope and deliverables", "Review and acceptance"] },
  { index: 3, copy: ["Product design milestone", "Research synthesis"] },
  { index: 4, copy: ["Northstar review", "Atlas milestone"] },
  { index: 5, copy: ["Clients", "Northstar Labs ↔ Northstar"] },
  { index: 6, copy: ["Identity", "Northstar product system"] },
];

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
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    test(`scrollytelling activates the chapter at scroll depth and the visual scene sticks at ${viewport.width}×${viewport.height}`, async ({ page }) => {
      const errors = collectRuntimeErrors(page);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.setViewportSize(viewport);
      await page.goto("/#product", { waitUntil: "load" });

      const scrolly = page.getByTestId("scrollytelling-section");
      const scene = page.getByTestId("scrollytelling-scene");
      await expect(page.getByTestId("scrollytelling-rail")).toHaveCount(0);
      await expect(scrolly).toBeVisible();
      await expect(scene).toBeVisible();
      await expect(scene.getByTestId("product-scene-motion")).toBeVisible();
      await expect(scene.getByTestId("problem-disconnection")).toBeVisible();
      await expect(scene.getByTestId("problem-disconnection").getByText("Northstar Labs")).toBeVisible();
      await expect(scene.getByTestId("problem-disconnection").getByText("No project attached")).toBeVisible();
      await page.waitForFunction(() => getComputedStyle(document.querySelector<HTMLElement>('[data-chapter-index="1"]')!).opacity === "0.3");

      const target = page.locator('[data-chapter-index="3"]');
      await target.evaluate((node) => node.scrollIntoView({ block: "start" }));
      await expect(target).toHaveAttribute("data-active", "true");
      await expect(scene.locator("[data-product-frame]").getByText("INV-1042")).toBeVisible();
      await expect(scene.locator("[data-product-frame]").getByText("Product design milestone")).toBeVisible();
      await expect(scene.locator("[data-product-frame]").getByText("Research synthesis")).toBeVisible();
      await expect(scene.locator("[data-product-frame]")).toHaveCount(1);
      await expect.poll(() => stuckHiddenRows(scene)).toEqual([]);

      const sticky = await scene.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { position: getComputedStyle(node).position, top: rect.top };
      });
      expect(sticky.position).toBe("sticky");
      expect(sticky.top).toBeGreaterThanOrEqual(64);
      expect(sticky.top).toBeLessThanOrEqual(120);

      const last = page.locator('[data-chapter-index="6"]');
      await last.evaluate((node) => node.scrollIntoView({ block: "start" }));
      await expect(last).toHaveAttribute("data-active", "true");
      await expect(scene.locator("[data-product-frame]").getByText("Portfolio Studio")).toBeVisible();
      await expect(scene.locator("[data-product-frame]").getByText("Identity")).toBeVisible();
      await expect(scene.locator("[data-product-frame]").getByText("Northstar product system")).toBeVisible();
      await expect(scene.locator("[data-product-frame]").getByText("Migration Engine")).toHaveCount(0);
      await expect(scene.locator("[data-product-frame]")).toHaveCount(1);
      await expect.poll(() => stuckHiddenRows(scene)).toEqual([]);

      expect(errors).toEqual([]);
    });
  }

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 },
  ]) {
    test(`every right-rail chapter reveals inner UI at ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.setViewportSize(viewport);
      await page.goto("/#product", { waitUntil: "load" });

      const scene = page.getByTestId("scrollytelling-scene");
      await expect(scene).toBeVisible();
      await page.waitForFunction(() => getComputedStyle(document.querySelector<HTMLElement>('[data-chapter-index="1"]')!).opacity === "0.3");

      for (const beat of RAIL_INNER_COPY) {
        const chapter = page.locator(`[data-chapter-index="${beat.index}"]`);
        await chapter.evaluate((node) => node.scrollIntoView({ block: "start" }));
        await expect(chapter).toHaveAttribute("data-active", "true");
        for (const text of beat.copy) {
          await expect(scene.getByText(text), `chapter ${beat.index} missing inner copy "${text}"`).toBeVisible();
        }
        await expect.poll(() => stuckHiddenRows(scene), { timeout: 4000 }).toEqual([]);
        await expect(scene.locator("[data-product-frame], [data-testid='problem-disconnection']")).toHaveCount(1);
      }

      await expect(scene.locator("[data-product-frame]").getByText("Portfolio Studio")).toBeVisible();
      await expect(scene.locator("[data-product-frame]").getByText("Migration Engine")).toHaveCount(0);
    });
  }

  /** Chapter activation once lived inside the resolved value of a dynamic gsap
   *  import, so a chunk that never arrives left the rail on the first mock for
   *  the whole page. A stale ?dpl= after a deploy, an ad blocker, or a dropped
   *  request is enough. Nothing about which chapter is active may wait on a
   *  deferred bundle.
   *
   *  The route drops a chunk that carries ScrollTrigger and not the page's own
   *  markup. `next dev` puts both in one chunk, so this only bites against the
   *  production build the deploy and CI jobs run. Aborting the shared dev chunk
   *  would stop hydration and prove nothing. */
  test("every right-rail chapter still activates when the gsap chunk never loads", async ({ page }) => {
    await page.route("**/_next/static/**/*.js", async (route) => {
      const response = await route.fetch().catch(() => null);
      if (!response) return route.continue();
      const body = await response.text();
      if (body.includes("ScrollTrigger") && !body.includes("scrollytelling-section")) return route.abort("failed");
      return route.fulfill({ response, body });
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "load" });

    const scene = page.getByTestId("scrollytelling-scene");
    await expect(scene).toBeVisible();

    for (const beat of RAIL_INNER_COPY) {
      const chapter = page.locator(`[data-chapter-index="${beat.index}"]`);
      await chapter.evaluate((node) => node.scrollIntoView({ block: "start" }));
      await expect(chapter, `chapter ${beat.index} never activated without gsap`).toHaveAttribute("data-active", "true");
      for (const text of beat.copy) {
        await expect(scene.getByText(text), `chapter ${beat.index} left the rail on the previous mock without gsap`).toBeVisible();
      }
      await expect(scene.locator("[data-product-frame], [data-testid='problem-disconnection']")).toHaveCount(1);
    }
    await expect(scene.locator("[data-product-frame]").getByText("Migration Engine")).toHaveCount(0);
  });

  /** The desktop and mobile behaviours were picked once from matchMedia at
   *  mount, so a window that grew past 1024px kept the mobile observer while
   *  CSS showed the sticky scene, and the rail then trailed the copy. */
  test("the right-rail follows the copy after a narrow window widens into desktop", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto("/", { waitUntil: "load" });
    await expect(page.getByTestId("scrollytelling-scene")).not.toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    const scene = page.getByTestId("scrollytelling-scene");
    await expect(scene).toBeVisible();
    await expect(page.locator('[data-chapter-index="1"]'), "inactive chapters never dimmed after the window widened").toHaveCSS("opacity", "0.3");

    for (const beat of RAIL_INNER_COPY) {
      const chapter = page.locator(`[data-chapter-index="${beat.index}"]`);
      await chapter.evaluate((node) => node.scrollIntoView({ block: "start" }));
      await expect(chapter, `chapter ${beat.index} never activated after the window widened`).toHaveAttribute("data-active", "true");
      for (const text of beat.copy) {
        await expect(scene.getByText(text), `chapter ${beat.index} left the rail behind after the window widened`).toBeVisible();
      }
    }
  });

  test("desktop scrollytelling scene stays in the HTML and survives two hard reloads at 1920×1080", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1920, height: 1080 });

    for (let pass = 0; pass < 2; pass += 1) {
      await page.goto("/#product", { waitUntil: "domcontentloaded" });
      const html = await page.content();
      expect(html, `reload ${pass + 1} missing scene in HTML`).toContain('data-testid="scrollytelling-scene"');
      expect(html, `reload ${pass + 1} still ships the shutter rail`).not.toContain('data-testid="scrollytelling-rail"');
      await page.waitForLoadState("load");
      const scene = page.getByTestId("scrollytelling-scene");
      await expect(page.getByTestId("scrollytelling-rail")).toHaveCount(0);
      await expect(scene, `reload ${pass + 1} scene missing`).toBeVisible();
      await expect(scene).toHaveCSS("position", "sticky");
      await expect(scene).toHaveCSS("display", "flex");
      await expect(page.locator("#product")).not.toHaveClass(/overflow-x-clip/);
    }
  });

  test("reduced motion keeps every chapter and product visual reachable without the sticky scene", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#product", { waitUntil: "load" });

    const chapters = page.locator("[data-chapter-index]");
    await expect(chapters).toHaveCount(7);
    await expect(page.getByTestId("scrollytelling-rail")).toHaveCount(0);
    await expect(page.getByTestId("scrollytelling-scene")).not.toBeVisible();
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
    await expect(pipeline).not.toContainText("Selected projects can become public portfolio proof");
    await expect(pipeline).not.toContainText(/context flows into the work/i);
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
  // First screen at scrollY=0: a readable hero — headline and both CTAs.
  // The CLIENT→PROOF rail may continue below the fold; do not crush the hero to
  // force it into one viewport. Extra short lines under the labels may drop
  // at 720. Do not hide the labels. Do not add 1366×768 or 1440×900 to this loop.
  // Do not assert which pipeline node is active — interval autoplay may already be on WORK.
  const heroStageLabels = ["CLIENT", "WORK", "AGREEMENT", "INVOICE", "PROOF"] as const;
  const minCtaRailGap = 24;

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1280, height: 800 },
  ]) {
    test(`the hero stays readable at ${viewport.width}×${viewport.height} 150% Windows-scale`, async ({ page }) => {
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
      await expect(hero.getByText("OPEN BETA", { exact: true })).toBeVisible();
      await expect(pipeline).toBeVisible();
      await expect(pipeline.getByTestId(/hero-stage-/)).toHaveCount(5);

      for (const label of heroStageLabels) {
        await expect(pipeline.locator(`[data-hero-stage-label="${label}"]`)).toBeVisible();
      }

      const geometry = await page.evaluate((stageLabels) => {
        const heroNode = document.querySelector("[data-testid='marketing-hero']");
        const header = document.querySelector("[data-testid='site-header']");
        const headline = heroNode?.querySelector("h1");
        const pipelineNode = document.querySelector("[data-testid='hero-pipeline']");
        const primary = heroNode?.querySelector("a[href='/register']");
        const secondary = heroNode?.querySelector("a[href='#problem']");
        if (!headline || !pipelineNode || !primary || !secondary) return null;
        const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
        const headlineRect = headline.getBoundingClientRect();
        const pipelineRect = pipelineNode.getBoundingClientRect();
        const primaryRect = primary.getBoundingClientRect();
        const secondaryRect = secondary.getBoundingClientRect();
        const ctaBottom = Math.max(primaryRect.bottom, secondaryRect.bottom);
        const overlaps = (a: DOMRect, b: DOMRect) => a.bottom > b.top + 1 && a.top < b.bottom - 1 && a.left < b.right - 1 && a.right > b.left + 1;
        const inFirstScreen = (rect: DOMRect) => rect.top >= headerBottom - 1 && rect.bottom <= window.innerHeight + 1;
        const labels = stageLabels.map((label) => {
          const node = pipelineNode.querySelector(`[data-hero-stage-label="${label}"]`)
            || Array.from(pipelineNode.querySelectorAll("span")).find((el) => el.textContent?.trim() === label && el.children.length === 0)
            || null;
          if (!node) return { label, found: false as const, display: "missing", visibility: "missing" };
          const style = getComputedStyle(node);
          return {
            label,
            found: true as const,
            display: style.display,
            visibility: style.visibility,
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
          pipelineTop: pipelineRect.top,
          headlineFits: inFirstScreen(headlineRect),
          primaryFits: inFirstScreen(primaryRect),
          secondaryFits: inFirstScreen(secondaryRect),
          ctaRailGap: pipelineRect.top - ctaBottom,
          ctaRailOverlap: overlaps(primaryRect, pipelineRect) || overlaps(secondaryRect, pipelineRect),
          headlineCtaOverlap: overlaps(headlineRect, primaryRect) || overlaps(headlineRect, secondaryRect),
          labels,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      }, [...heroStageLabels]);

      expect(geometry, `${viewport.width}×${viewport.height} missing hero geometry`).not.toBeNull();
      expect(geometry!.scrollY).toBe(0);
      expect(geometry!.headlineTop).toBeGreaterThanOrEqual(geometry!.headerBottom - 1);
      expect(geometry!.headlineFits, `${viewport.width}×${viewport.height} headline clipped`).toBe(true);
      expect(geometry!.primaryFits, `${viewport.width}×${viewport.height} primary CTA clipped`).toBe(true);
      expect(geometry!.secondaryFits, `${viewport.width}×${viewport.height} secondary CTA clipped`).toBe(true);
      expect(geometry!.ctaRailOverlap, `${viewport.width}×${viewport.height} pipeline overlaps CTAs`).toBe(false);
      expect(geometry!.headlineCtaOverlap, `${viewport.width}×${viewport.height} headline overlaps CTAs`).toBe(false);
      expect(geometry!.ctaRailGap, `${viewport.width}×${viewport.height} CTA/rail gap ${geometry!.ctaRailGap}`).toBeGreaterThanOrEqual(minCtaRailGap);
      expect(geometry!.overflow).toBe(false);
      expect(geometry!.labels).toHaveLength(heroStageLabels.length);
      for (const row of geometry!.labels) {
        expect(row.found, `${viewport.width}×${viewport.height} missing ${row.label}`).toBe(true);
        expect(row.display, `${viewport.width}×${viewport.height} ${row.label} display`).not.toBe("none");
        expect(row.visibility, `${viewport.width}×${viewport.height} ${row.label} visibility`).not.toBe("hidden");
      }
    });
  }

  test.describe("150% Windows scale (devicePixelRatio 1.5)", () => {
    test.use({ deviceScaleFactor: 1.5 });

    test("the hero and pipeline fit a 1707×960 QHD 150% laptop at rest", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.setViewportSize({ width: 1707, height: 960 });
      await page.goto("/", { waitUntil: "load" });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      const pipeline = page.getByTestId("hero-pipeline");
      await expect(page.getByTestId("marketing-hero").locator("h1")).toBeVisible();
      await expect(pipeline).toBeVisible();
      for (const label of heroStageLabels) {
        await expect(pipeline.locator(`[data-hero-stage-label="${label}"]`)).toBeVisible();
      }

      const geometry = await page.evaluate((stageLabels) => {
        const heroNode = document.querySelector("[data-testid='marketing-hero']");
        const header = document.querySelector("[data-testid='site-header']");
        const headline = heroNode?.querySelector("h1");
        const pipelineNode = document.querySelector("[data-testid='hero-pipeline']");
        const primary = heroNode?.querySelector("a[href='/register']");
        const secondary = heroNode?.querySelector("a[href='#problem']");
        if (!headline || !pipelineNode || !primary || !secondary) return null;
        const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
        const overlaps = (a: DOMRect, b: DOMRect) => a.bottom > b.top + 1 && a.top < b.bottom - 1 && a.left < b.right - 1 && a.right > b.left + 1;
        const inFirstScreen = (rect: DOMRect) => rect.top >= headerBottom - 1 && rect.bottom <= window.innerHeight + 1;
        const primaryRect = primary.getBoundingClientRect();
        const secondaryRect = secondary.getBoundingClientRect();
        const pipelineRect = pipelineNode.getBoundingClientRect();
        const ctaBottom = Math.max(primaryRect.bottom, secondaryRect.bottom);
        const labels = stageLabels.map((label) => {
          const node = pipelineNode.querySelector(`[data-hero-stage-label="${label}"]`);
          if (!node) return { label, found: false as const, inFirstScreen: false };
          return { label, found: true as const, inFirstScreen: inFirstScreen(node.getBoundingClientRect()) };
        });
        const shortNode = pipelineNode.querySelector("[data-hero-stage-short]");
        return {
          dpr: window.devicePixelRatio,
          innerHeight: window.innerHeight,
          headlineFits: inFirstScreen(headline.getBoundingClientRect()),
          primaryFits: inFirstScreen(primaryRect),
          secondaryFits: inFirstScreen(secondaryRect),
          pipelineFits: inFirstScreen(pipelineRect),
          pipelineBottom: pipelineRect.bottom,
          h1Size: Number.parseFloat(getComputedStyle(headline).fontSize),
          shortsDisplay: shortNode ? getComputedStyle(shortNode).display : "missing",
          ctaRailGap: pipelineRect.top - ctaBottom,
          ctaRailOverlap: overlaps(primaryRect, pipelineRect) || overlaps(secondaryRect, pipelineRect),
          labels,
        };
      }, [...heroStageLabels]);

      expect(geometry).not.toBeNull();
      expect(geometry!.dpr).toBeGreaterThanOrEqual(1.25);
      expect(geometry!.headlineFits, "1707×960 headline clipped").toBe(true);
      expect(geometry!.primaryFits, "1707×960 primary CTA clipped").toBe(true);
      expect(geometry!.secondaryFits, "1707×960 secondary CTA clipped").toBe(true);
      expect(geometry!.pipelineFits, "1707×960 pipeline clipped").toBe(true);
      expect(geometry!.pipelineBottom).toBeLessThanOrEqual(geometry!.innerHeight - 24);
      expect(geometry!.h1Size, "150% scale left the 104px desktop headline").toBeLessThan(72);
      expect(geometry!.shortsDisplay, "150% QHD dropped the stage shorts").not.toBe("none");
      expect(geometry!.ctaRailOverlap, "1707×960 pipeline overlaps CTAs").toBe(false);
      expect(geometry!.ctaRailGap, `1707×960 CTA/rail gap ${geometry!.ctaRailGap}`).toBeGreaterThanOrEqual(minCtaRailGap);
      for (const row of geometry!.labels) {
        expect(row.found, `1707×960 missing ${row.label}`).toBe(true);
        expect(row.inFirstScreen, `1707×960 ${row.label} clipped`).toBe(true);
      }
    });
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
    await expect.poll(async () => page.evaluate(() => {
      const header = document.querySelector("[data-testid='site-header']");
      const problemNode = document.querySelector("[data-testid='marketing-problem']");
      const eyebrow = problemNode?.querySelector("p");
      if (!header || !problemNode || !eyebrow) return 999;
      return eyebrow.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
    })).toBeGreaterThanOrEqual(-1);
    await expect.poll(async () => page.evaluate(() => {
      const header = document.querySelector("[data-testid='site-header']");
      const problemNode = document.querySelector("[data-testid='marketing-problem']");
      if (!header || !problemNode) return 999;
      return Math.abs(problemNode.getBoundingClientRect().top - header.getBoundingClientRect().bottom);
    })).toBeLessThan(48);
    await expect(problem.getByRole("heading", { name: "There is an unpaid role inside every independent business." })).toBeVisible();
    await expect(page.getByTestId("scrollytelling-rail")).toHaveCount(0);
    await expect(page.getByTestId("scrollytelling-scene")).toBeVisible();
    await expect(page.getByTestId("scrollytelling-scene").getByTestId("problem-disconnection")).toBeVisible();
    const stacked = await page.evaluate(() => {
      const problemRect = document.querySelector("[data-testid='marketing-problem']")!.getBoundingClientRect();
      const solutionRect = document.querySelector('[data-chapter-index="1"]')!.getBoundingClientRect();
      return { problemBottom: problemRect.bottom, solutionTop: solutionRect.top };
    });
    expect(stacked.solutionTop).toBeGreaterThan(stacked.problemBottom - 1);
  });

  test("the problem beat hands off into the connected loop without a viewport shutter", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "load" });
    const stage = page.getByTestId("marketing-problem");
    const geometry = await stage.evaluate((node) => {
      const style = getComputedStyle(node);
      const article = node.closest("[data-chapter-index='0']");
      const articleStyle = article ? getComputedStyle(article) : style;
      return {
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        minHeight: style.minHeight,
        articleMinHeight: articleStyle.minHeight,
      };
    });
    expect(geometry.overflow).toBe(false);
    expect(viewportMinHeight(geometry.minHeight), "problem beat min-height is a viewport shutter").toBe(false);
    expect(viewportMinHeight(geometry.articleMinHeight), "problem article min-height is a viewport shutter").toBe(false);

    const scene = page.getByTestId("scrollytelling-scene");
    await expect(page.getByTestId("scrollytelling-rail")).toHaveCount(0);
    await page.locator("#problem").evaluate((node) => node.scrollIntoView({ block: "start" }));
    await expect(page.getByTestId("problem-duties")).toBeVisible();
    await expect(scene.getByTestId("problem-disconnection")).toBeVisible();
    await expect(scene.locator("[data-product-frame]")).toHaveCount(0);

    const solution = page.locator('[data-chapter-index="1"]');
    await solution.evaluate((node) => node.scrollIntoView({ block: "start" }));
    await expect(solution).toHaveAttribute("data-active", "true");
    await expect(solution.getByRole("heading", { name: "Change one thing. Everything downstream already knows." })).toBeVisible();
    await expect.poll(async () => ({
      product: await scene.locator("[data-product-frame]").count(),
      problem: await scene.getByTestId("problem-disconnection").count(),
    })).toEqual({ product: 1, problem: 0 });
    await expect(scene.getByText("Recent activity")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "load" });
    await expect(page.getByTestId("marketing-problem")).toBeVisible();
    await expect(page.getByTestId("marketing-problem").getByTestId("problem-disconnection")).toBeVisible();
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(mobileOverflow).toBe(false);
  });

  test("mobile scrollytelling is one claim and one compact picture per beat", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#product", { waitUntil: "load" });

    await expect(page.getByTestId("scrollytelling-rail")).toHaveCount(0);
    await expect(page.getByTestId("scrollytelling-scene")).toBeHidden();
    await expect(page.getByTestId("problem-duties")).toBeHidden();
    await expect(page.getByTestId("marketing-problem").getByText("Rebuild the client")).toBeHidden();
    await expect(page.getByTestId("marketing-problem").getByTestId("problem-disconnection")).toBeVisible();
    await expect(page.getByTestId("marketing-problem").getByText("Northstar Labs")).toBeVisible();
    await expect(page.getByTestId("marketing-problem").getByText("No project attached")).toBeHidden();

    const chapters = await page.evaluate(() => {
      return Array.from(document.querySelectorAll<HTMLElement>("[data-chapter-index]")).map((node) => {
        const minHeight = getComputedStyle(node).minHeight;
        return {
          index: node.dataset.chapterIndex,
          minHeight,
          minPx: Number.parseFloat(minHeight) || 0,
          vh: window.innerHeight,
        };
      });
    });
    expect(chapters).toHaveLength(7);
    for (const cut of chapters) {
      expect(
        isSeventyVhMinHeight(cut.minHeight, cut.vh),
        `chapter ${cut.index} still has a 70vh shutter (${cut.minHeight})`,
      ).toBe(false);
    }

    const first = page.locator('[data-chapter-index="1"]');
    await first.evaluate((node) => node.scrollIntoView({ block: "start" }));
    await expect(first.locator("[data-product-frame]")).toBeVisible();
    await expect(first.getByText("Revenue collected")).toBeVisible();
    await expect(first.getByText("Recent activity")).toBeHidden();
  });

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 },
  ]) {
    test(`no sticky shutter covers the page at ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.setViewportSize(viewport);
      await page.goto("/", { waitUntil: "load" });
      expect(await coveringStickyShutter(page), `${viewport.width}×${viewport.height} shutter on first screen`).toEqual([]);

      await page.locator("#problem").evaluate((node) => node.scrollIntoView({ block: "start" }));
      expect(await coveringStickyShutter(page), `${viewport.width}×${viewport.height} shutter at problem`).toEqual([]);

      const chapterCuts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll<HTMLElement>("[data-chapter-index]")).map((node) => {
          const style = getComputedStyle(node);
          return { index: node.dataset.chapterIndex, minHeight: style.minHeight };
        });
      });
      for (const cut of chapterCuts) {
        expect(viewportMinHeight(cut.minHeight), `chapter ${cut.index} min-height is a viewport shutter`).toBe(false);
      }

      if (viewport.width >= 1024) {
        await expect(page.getByTestId("scrollytelling-rail")).toHaveCount(0);
        const scene = page.getByTestId("scrollytelling-scene");
        await expect(scene).toBeVisible();
        const sceneBox = await scene.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          const mock = node.querySelector<HTMLElement>("[data-product-frame], [data-testid='problem-disconnection']");
          const mockRect = mock?.getBoundingClientRect();
          return {
            position: style.position,
            width: rect.width,
            mockHeight: mockRect?.height ?? rect.height,
            left: rect.left,
            vw: window.innerWidth,
            vh: window.innerHeight,
          };
        });
        expect(sceneBox.position).toBe("sticky");
        expect(sceneBox.width, `${viewport.width}×${viewport.height} scene became a full-width shutter`).toBeLessThan(sceneBox.vw * 0.8);
        expect(sceneBox.mockHeight, `${viewport.width}×${viewport.height} product mock became a viewport-tall shutter`).toBeLessThan(sceneBox.vh * 0.92);

        const overlap = await page.evaluate(() => {
          const heading = document.querySelector("[data-testid='marketing-problem'] h2");
          const sceneNode = document.querySelector("[data-testid='scrollytelling-scene']");
          if (!heading || !sceneNode) return null;
          const copy = heading.getBoundingClientRect();
          const sceneRect = sceneNode.getBoundingClientRect();
          const coversCopy = copy.right > sceneRect.left + 8 && copy.left < sceneRect.right - 8 && copy.bottom > sceneRect.top + 8 && copy.top < sceneRect.bottom - 8;
          return { coversCopy, copyRight: copy.right, sceneLeft: sceneRect.left };
        });
        expect(overlap, `${viewport.width}×${viewport.height} missing problem copy or scene`).not.toBeNull();
        expect(overlap!.coversCopy, `${viewport.width}×${viewport.height} scene overlays problem copy`).toBe(false);
      }
    });
  }

  test("brand fonts are preloaded and stable after first paint", async ({ page }) => {
    const fontRequests: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "font") fontRequests.push(new URL(request.url()).pathname);
    });

    /* The document response has to carry both preloads on its own, before any
       client JavaScript runs. React picks the transport from the render mode.
       A prerendered `/` gets head tags in the cached HTML and a per-request
       render gets an HTTP Link header, so assert against both. */
    const documentOnly = await page.request.get("/");
    const advertised = `${documentOnly.headers().link ?? ""}\n${await documentOnly.text()}`.toLowerCase();
    expect(advertised, "the document response never advertised the Outfit preload").toContain("/fonts/outfit-marketing.woff2");
    expect(advertised, "the document response never advertised the Mono preload").toContain("/fonts/jetbrains-mono-marketing.woff2");
    expect(advertised).toMatch(/rel="?preload/);
    expect(advertised).toContain("fetchpriority=\"high\"");

    await page.goto("/", { waitUntil: "domcontentloaded" });
    const preloadLinks = page.locator('head link[rel="preload"][as="font"]');
    await expect(preloadLinks).toHaveCount(2);

    const preloads = await preloadLinks.evaluateAll((links) =>
      links.map((link) => {
        const node = link as HTMLLinkElement;
        return {
          href: new URL(node.href).pathname,
          type: node.type,
          crossOrigin: node.crossOrigin,
          fetchPriority: node.fetchPriority,
        };
      }),
    );
    expect(preloads).toEqual([
      { href: "/fonts/outfit-marketing.woff2", type: "font/woff2", crossOrigin: "anonymous", fetchPriority: "high" },
      { href: "/fonts/jetbrains-mono-marketing.woff2", type: "font/woff2", crossOrigin: "anonymous", fetchPriority: "low" },
    ]);

    const fontResponse = await page.request.get("/fonts/outfit-marketing.woff2");
    expect(fontResponse.headers()["cache-control"]).toMatch(/max-age=31536000/);
    expect(fontResponse.headers()["cache-control"]).toContain("immutable");

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

  test("share and search head tags carry a real image and honest structured data", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const ogImageTag = page.locator('head meta[property="og:image"]');
    const twitterImageTag = page.locator('head meta[name="twitter:image"]');
    await expect(ogImageTag, "the homepage ships no og:image").toHaveCount(1);
    await expect(twitterImageTag, "the homepage ships no twitter:image").toHaveCount(1);

    const ogImage = await ogImageTag.getAttribute("content");
    const twitterImage = await twitterImageTag.getAttribute("content");
    expect(ogImage).toMatch(/^https?:\/\//);
    expect(twitterImage).toMatch(/^https?:\/\//);

    /* metadataBase resolves while the page prerenders, so a build that bakes a
       fixed origin ships share tags pointing away from the site serving them.
       CI bakes 127.0.0.1 while Playwright drives localhost, so the two loopback
       spellings of one host fold together. */
    const servingOrigin = (value: string) => {
      const { protocol, hostname, port } = new URL(value);
      return `${protocol}//${hostname === "localhost" ? "127.0.0.1" : hostname}:${port}`;
    };
    const pageOrigin = servingOrigin(page.url());
    expect(servingOrigin(ogImage!), "og:image points off the serving origin").toBe(pageOrigin);
    expect(servingOrigin(twitterImage!), "twitter:image points off the serving origin").toBe(pageOrigin);

    const image = await page.request.get(ogImage!);
    expect(image.status(), `og:image did not serve: ${ogImage}`).toBe(200);
    expect(image.headers()["content-type"]).toMatch(/^image\//);

    const payloads = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ""));
    expect(payloads, "the homepage ships no JSON-LD").toHaveLength(1);
    const graph = (JSON.parse(payloads[0]) as { "@graph": { "@type": string }[] })["@graph"];
    expect(graph.map((node) => node["@type"])).toEqual(
      expect.arrayContaining(["Organization", "WebSite"]),
    );
  });

  test("marketing headings form a valid outline", async ({ page }) => {
    for (const route of ["/", "/about", "/contact", "/privacy", "/changelog", "/roadmap"]) {
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

  test("the navbar exposes Pricing as a top-level link and has no Learn section", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const header = page.getByTestId("site-header");
    const primaryNav = header.getByRole("navigation", { name: "Primary navigation" });
    await expect(primaryNav.getByRole("link", { name: "Pricing", exact: true })).toBeVisible();
    await expect(primaryNav.getByRole("button", { name: "Learn" })).toHaveCount(0);
    await expect(primaryNav.getByRole("link", { name: "Documentation" })).toHaveCount(0);

    await primaryNav.getByRole("button", { name: "Product" }).hover();
    const productMenu = header.locator("#nav-product");
    await expect(productMenu.getByRole("link", { name: "The connected loop" })).toBeVisible();
    await expect(productMenu.getByRole("link", { name: "Pricing" })).toHaveCount(0);

    await primaryNav.getByRole("button", { name: "Company" }).hover();
    const companyMenu = header.locator("#nav-company");
    await expect(companyMenu.getByRole("link", { name: "About" })).toBeVisible();
    await expect(companyMenu.getByRole("link", { name: "Changelog" })).toBeVisible();
    await expect(companyMenu.getByRole("link", { name: "Roadmap" })).toBeVisible();
    await expect(companyMenu.getByRole("link", { name: "Careers" })).toHaveCount(0);
    await expect(companyMenu.getByRole("link", { name: "Press" })).toHaveCount(0);

    const footer = page.locator("footer");
    await expect(footer.getByRole("heading", { name: "Learn" })).toHaveCount(0);
    await expect(footer.getByRole("link", { name: "Documentation" })).toHaveCount(0);
    await expect(footer.getByRole("link", { name: "Guides" })).toHaveCount(0);
    await expect(footer.getByRole("link", { name: "API reference" })).toHaveCount(0);
    await expect(footer.getByRole("link", { name: "Blog" })).toHaveCount(0);
    await expect(footer.getByRole("link", { name: "Community" })).toHaveCount(0);
    await expect(footer.getByRole("link", { name: "Pricing", exact: true })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Careers" })).toHaveCount(0);
    await expect(footer.getByRole("link", { name: "Press" })).toHaveCount(0);
  });

  test("mobile company nav has no Careers or Press", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Open navigation" }).click();
    const nav = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(nav.getByRole("link", { name: "About", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Changelog", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Roadmap", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Careers" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Press" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Pricing", exact: true })).toBeVisible();
  });

  test("retired marketing routes are gone", async ({ page }) => {
    for (const route of ["/docs", "/guides", "/api-reference", "/blog", "/community", "/careers", "/press"]) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route} should be removed`).toBe(404);
    }
  });

  test("company pages share a single left content edge", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const route of ["/about", "/changelog", "/roadmap"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const lefts = await page.evaluate(() => {
        const h1 = document.querySelector("main h1") ?? document.querySelector("h1");
        const h2 = document.querySelector("main h2") ?? document.querySelector("h2");
        return {
          h1: h1?.getBoundingClientRect().left ?? Number.NaN,
          h2: h2?.getBoundingClientRect().left ?? Number.NaN,
        };
      });
      expect(lefts.h1, `${route} is missing an h1`).toBeGreaterThan(0);
      expect(lefts.h2, `${route} is missing an h2`).toBeGreaterThan(0);
      expect(Math.abs(lefts.h1 - lefts.h2), `${route} h1/h2 left edge`).toBeLessThan(2);
    }
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

      await page.setViewportSize({ width: 1920, height: 1080 });
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
      expect(html).toContain('data-testid="scrollytelling-scene"');
      expect(html).not.toContain('data-testid="scrollytelling-rail"');

      await expect(page.getByTestId("scrollytelling-rail")).toHaveCount(0);
      await expect(page.getByTestId("scrollytelling-scene")).toBeVisible();
      await expect(page.getByText("Know the payout before you send it.")).toHaveCount(0);
    });
  });
});
