import { expect, test } from "@playwright/test";

const PATH_SECRET = "pw-sign-token-material";
const REFERRER_SECRET = "pw-referrer-token-material";

function containsSecret(value: unknown): boolean {
  if (typeof value === "string") return value.includes(PATH_SECRET) || value.includes(REFERRER_SECRET);
  if (Array.isArray(value)) return value.some(containsSecret);
  if (value && typeof value === "object") return Object.values(value).some(containsSecret);
  return false;
}

test("a tokenized sign link exchanges to the clean page and reports only the clean path to analytics", async ({ page, baseURL }) => {
  const trackedBodies: Record<string, unknown>[] = [];
  await page.route("**/api/track", async (route) => {
    trackedBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });
  // Emulate the session exchange: valid bearer link → 303 to the clean page.
  await page.route("**/api/public/contracts/sign/*/session", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ status: 303, headers: { location: `/sign${url.search}` } });
  });
  // The clean page's session lookup finds no live session → closed state.
  await page.route("**/api/public/contracts/sign/session", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ success: false, message: "Acceptance link not found." }),
    });
  });

  const origin = new URL(baseURL || "http://localhost:3000").origin;
  // The tokenized redirect response carries Referrer-Policy: no-referrer, so
  // the referrer is dropped for the rest of the redirect chain and
  // document.referrer is empty by the time the clean page loads.
  const sanitizedReferrer = "";
  const trackResponse = page.waitForResponse(
    (response) => response.url().includes("/api/track") && response.request().method() === "POST",
  );
  await page.goto(`/sign/${PATH_SECRET}?utm_source=test`, {
    referer: `${origin}/review/${REFERRER_SECRET}?x=1`,
    waitUntil: "domcontentloaded",
  });
  await trackResponse;

  await expect(page.getByText("Acceptance request closed")).toBeVisible();
  // The exchange redirect removed the bearer token from the address bar.
  expect(new URL(page.url()).pathname).toBe("/sign");
  expect(page.url()).not.toContain(PATH_SECRET);

  expect(trackedBodies.length).toBeGreaterThan(0);
  const body = trackedBodies[0];
  expect(body.path).toBe("/sign");
  expect(body.landingPage).toBe("/sign");
  expect(containsSecret(body)).toBe(false);
  expect(body.referrer).toBe(sanitizedReferrer);

  await page.goto(`/sign/${PATH_SECRET}`, {
    referer: `${origin}/review/${REFERRER_SECRET}?x=1`,
    waitUntil: "domcontentloaded",
  });
  await expect
    .poll(() => trackedBodies.some((tracked) => tracked.source === "direct"))
    .toBe(true);

  expect(new URL(page.url()).pathname).toBe("/sign");
  const secondBody = trackedBodies.find((tracked) => tracked.source === "direct");
  expect(secondBody?.path).toBe("/sign");
  expect(secondBody?.medium).toBe("none");
  expect(secondBody?.referrer).toBe(sanitizedReferrer);
  expect(containsSecret(secondBody)).toBe(false);
});

const ANALYTICS_COOKIES = ["rive_anonymous_id", "rive_analytics_session", "rive_attribution"];

test("analytics cookies are rewritten as session cookies after navigation", async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL || "http://localhost:3000").origin;
  await page.route("**/api/track", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });
  const futureExpiry = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
  const poisonedAttribution = {
    source: "legacy",
    firstLandingPage: `/sign/${PATH_SECRET}`,
    lastLandingPage: `/invoice/${PATH_SECRET}?x=1`,
    landingPage: `/sign/${PATH_SECRET}?y=2`,
    firstReferrer: `https://external.example/review/${REFERRER_SECRET}?x=1`,
    lastReferrer: `https://external.example/invoice/${REFERRER_SECRET}?x=1`,
    referrer: `https://external.example/sign/${REFERRER_SECRET}?x=1`,
  };
  await context.addCookies(ANALYTICS_COOKIES.map((name) => ({
    name,
    value: name === "rive_attribution" ? encodeURIComponent(JSON.stringify(poisonedAttribution)) : "legacy-value",
    url: origin,
    expires: futureExpiry,
    sameSite: "Lax",
  })));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect
    .poll(async () => (await context.cookies(origin)).filter((cookie) => ANALYTICS_COOKIES.includes(cookie.name) && cookie.expires === -1).length)
    .toBe(ANALYTICS_COOKIES.length);

  const cookies = await context.cookies(origin);
  for (const name of ANALYTICS_COOKIES) {
    const cookie = cookies.find((entry) => entry.name === name);
    expect(cookie, name).toBeTruthy();
    expect(cookie?.expires).toBe(-1);
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie?.secure).toBe(new URL(origin).protocol === "https:");
  }
  expect(cookies.find((entry) => entry.name === "rive_anonymous_id")?.value).toBe("legacy-value");

  const attributionRaw = cookies.find((entry) => entry.name === "rive_attribution")?.value || "";
  const attribution = JSON.parse(decodeURIComponent(attributionRaw)) as Record<string, unknown>;
  expect(containsSecret(attribution)).toBe(false);
  expect(attribution.firstLandingPage).toBe("/sign/[token]");
  expect(attribution.lastLandingPage).toBe("/invoice/[token]");
  expect(attribution.landingPage).toBe("/invoice/[token]");
  expect(attribution.firstReferrer).toBe("https://external.example/review/[token]");
  expect(attribution.lastReferrer).toBe("https://external.example/invoice/[token]");
  expect(attribution.referrer).toBe("https://external.example/invoice/[token]");
  for (const field of ["firstLandingPage", "lastLandingPage", "landingPage", "firstReferrer", "lastReferrer", "referrer"]) {
    expect(String(attribution[field] ?? ""), field).not.toContain("?");
  }
});

test("tokenized public routes respond with no-referrer and no-store headers", async ({ request }) => {
  const page = await request.get("/sign/example-token");
  expect(page.headers()["referrer-policy"]).toBe("no-referrer");
  const api = await request.get("/api/public/contracts/sign/example-token");
  expect(api.headers()["referrer-policy"]).toBe("no-referrer");
  expect(api.headers()["cache-control"] || "").toContain("no-store");
});
