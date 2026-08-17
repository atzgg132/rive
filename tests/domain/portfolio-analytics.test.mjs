import assert from "node:assert/strict";
import test from "node:test";

import {
  attentionShare,
  buildPortfolioVisitorHash,
  conversionRate,
  DEFAULT_PORTFOLIO_ANALYTICS_RANGE,
  deviceFromUserAgent,
  isKnownBotUserAgent,
  isUnconvertedProject,
  normalizePortfolioReferrer,
  parsePortfolioAnalyticsRange,
  percentageChange,
  PORTFOLIO_ANALYTICS_RANGES,
  portfolioTimelineDays,
  PROJECT_ATTENTION_MIN_VIEWS,
  resolvePortfolioAnalyticsWindow,
} from "../../src/utils/portfolioAnalytics.ts";

test("normalizes external referrers to their origin", () => {
  assert.equal(
    normalizePortfolioReferrer("https://www.google.com/search?q=portfolio#results"),
    "https://www.google.com",
  );
  assert.equal(normalizePortfolioReferrer("http://example.com:8080/article"), "http://example.com:8080");
});

test("removes first-party and local referrers", () => {
  for (const referrer of [
    "https://rive.work/",
    "https://www.rive.work/p/atzgg132",
    "https://dev.rive.work/p/atzgg132/product-design",
    "http://localhost:3000/portfolio",
    "http://127.0.0.1:3000/portfolio",
  ]) {
    assert.equal(normalizePortfolioReferrer(referrer), null, referrer);
  }
});

test("treats missing, invalid, and non-web referrers as direct", () => {
  assert.equal(normalizePortfolioReferrer(null), null);
  assert.equal(normalizePortfolioReferrer(""), null);
  assert.equal(normalizePortfolioReferrer("not a URL"), null);
  assert.equal(normalizePortfolioReferrer("mailto:hello@example.com"), null);
});

/* --------------------------------------------------------------------- */
/* Bot and device classification                                         */
/* --------------------------------------------------------------------- */

test("excludes crawlers, unfurlers, and scripted clients from view counts", () => {
  for (const userAgent of [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0)",
    "facebookexternalhit/1.1",
    "Twitterbot/1.0",
    "Slackbot-LinkExpanding 1.0",
    "WhatsApp/2.19",
    "Mozilla/5.0 AhrefsBot/7.0",
    "curl/8.4.0",
    "python-requests/2.31.0",
    "node-fetch/1.0",
    "Go-http-client/2.0",
    "PostmanRuntime/7.36.0",
    "Mozilla/5.0 HeadlessChrome/120.0.0.0",
    "Chrome-Lighthouse",
  ]) {
    assert.equal(isKnownBotUserAgent(userAgent), true, userAgent);
  }
});

test("an absent user agent is treated as automated, not as a visitor", () => {
  assert.equal(isKnownBotUserAgent(""), true);
  assert.equal(isKnownBotUserAgent(null), true);
  assert.equal(isKnownBotUserAgent(undefined), true);
  assert.equal(isKnownBotUserAgent("   "), true);
});

test("keeps real browsers", () => {
  for (const userAgent of [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  ]) {
    assert.equal(isKnownBotUserAgent(userAgent), false, userAgent);
  }
});

test("classifies tablets separately from phones", () => {
  // The previous single combined test matched "ipad" inside the mobile branch,
  // so every iPad was silently counted as a phone.
  assert.equal(
    deviceFromUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"),
    "tablet",
  );
  assert.equal(deviceFromUserAgent("Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 Safari/537.36"), "tablet");
  assert.equal(
    deviceFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"),
    "mobile",
  );
  assert.equal(
    deviceFromUserAgent("Mozilla/5.0 (Linux; Android 13; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36"),
    "mobile",
  );
  assert.equal(deviceFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0"), "desktop");
  assert.equal(deviceFromUserAgent(""), "unknown");
});

/* --------------------------------------------------------------------- */
/* Visitor identity                                                      */
/* --------------------------------------------------------------------- */

test("visitor hashes are stable within a day and never contain the address", () => {
  const at = new Date("2026-08-17T10:00:00.000Z");
  const first = buildPortfolioVisitorHash({ ip: "203.0.113.7", userAgent: "Chrome", at });
  const later = buildPortfolioVisitorHash({ ip: "203.0.113.7", userAgent: "Chrome", at: new Date("2026-08-17T23:59:00.000Z") });

  assert.equal(first, later, "the same visitor on the same day resolves to one identity");
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.ok(!first.includes("203.0.113.7"));
});

test("visitor hashes separate different visitors, and rotate daily", () => {
  const at = new Date("2026-08-17T10:00:00.000Z");
  const base = buildPortfolioVisitorHash({ ip: "203.0.113.7", userAgent: "Chrome", at });

  assert.notEqual(base, buildPortfolioVisitorHash({ ip: "203.0.113.8", userAgent: "Chrome", at }));
  assert.notEqual(base, buildPortfolioVisitorHash({ ip: "203.0.113.7", userAgent: "Firefox", at }));
  assert.notEqual(
    base,
    buildPortfolioVisitorHash({ ip: "203.0.113.7", userAgent: "Chrome", at: new Date("2026-08-18T10:00:00.000Z") }),
    "an identity must not be followable across days",
  );
});

/* --------------------------------------------------------------------- */
/* Ranges                                                                */
/* --------------------------------------------------------------------- */

test("accepts every supported range and defaults when none is given", () => {
  for (const range of PORTFOLIO_ANALYTICS_RANGES) {
    assert.equal(parsePortfolioAnalyticsRange(range), range);
  }
  assert.equal(parsePortfolioAnalyticsRange(" 90D "), "90d", "input is trimmed and case-insensitive");
  assert.equal(parsePortfolioAnalyticsRange(null), DEFAULT_PORTFOLIO_ANALYTICS_RANGE);
  assert.equal(parsePortfolioAnalyticsRange(""), DEFAULT_PORTFOLIO_ANALYTICS_RANGE);
});

test("rejects unsupported ranges rather than falling back", () => {
  for (const value of ["1d", "365d", "week", "30", "all-time", "-7d", "DROP TABLE"]) {
    assert.equal(parsePortfolioAnalyticsRange(value), null, value);
  }
});

test("resolves a comparable previous period for bounded ranges", () => {
  const now = new Date("2026-08-17T12:00:00.000Z");
  const window = resolvePortfolioAnalyticsWindow("7d", now);

  assert.equal(window.days, 7);
  assert.equal(window.since.toISOString(), "2026-08-10T12:00:00.000Z");
  assert.equal(window.previous.since.toISOString(), "2026-08-03T12:00:00.000Z");
  assert.equal(window.previous.until.toISOString(), window.since.toISOString());
  assert.equal(
    window.until.getTime() - window.since.getTime(),
    window.previous.until.getTime() - window.previous.since.getTime(),
    "the comparison window must be the same length",
  );
});

test("an all-time range has no lower bound and no invented baseline", () => {
  const window = resolvePortfolioAnalyticsWindow("all", new Date("2026-08-17T12:00:00.000Z"));
  assert.equal(window.since, null);
  assert.equal(window.days, null);
  assert.equal(window.previous, null);
});

test("timeline days cover the window without gaps and stay bounded", () => {
  const now = new Date("2026-08-17T12:00:00.000Z");
  const days = portfolioTimelineDays(resolvePortfolioAnalyticsWindow("7d", now), null);

  assert.equal(days.length, 8, "inclusive of both endpoints");
  assert.equal(days[0], "2026-08-10");
  assert.equal(days.at(-1), "2026-08-17");

  // An all-time range on an old portfolio must not produce an unreadable chart.
  const ancient = portfolioTimelineDays(
    resolvePortfolioAnalyticsWindow("all", now),
    new Date("2015-01-01T00:00:00.000Z"),
  );
  assert.ok(ancient.length <= 400, `expected a bounded timeline, got ${ancient.length}`);

  // With no lower bound and nothing recorded, there is no timeline at all.
  assert.deepEqual(portfolioTimelineDays(resolvePortfolioAnalyticsWindow("all", now), null), []);
});

/* --------------------------------------------------------------------- */
/* Derived figures                                                       */
/* --------------------------------------------------------------------- */

test("reports movement only when there is an honest baseline", () => {
  assert.equal(percentageChange(150, 100), 50);
  assert.equal(percentageChange(50, 100), -50);
  assert.equal(percentageChange(100, 100), 0);
  assert.equal(percentageChange(10, null), null, "no previous period");
  assert.equal(percentageChange(10, 0), null, "growth from nothing is not a percentage");
});

test("attention share and conversion rate degrade safely at zero", () => {
  assert.equal(attentionShare(25, 100), 25);
  assert.equal(attentionShare(1, 3), 33.3);
  assert.equal(attentionShare(5, 0), 0);
  assert.equal(conversionRate(2, 100), 2);
  assert.equal(conversionRate(0, 100), 0);
  assert.equal(conversionRate(3, 0), 0);
});

test("only flags an unconverted project when the data supports the claim", () => {
  const enough = PROJECT_ATTENTION_MIN_VIEWS;

  assert.equal(
    isUnconvertedProject({ views: enough, inquiries: 0, totalInquiries: 4 }),
    true,
    "well-read, no enquiries, while other work converts",
  );
  assert.equal(
    isUnconvertedProject({ views: enough - 1, inquiries: 0, totalInquiries: 4 }),
    false,
    "too few views to draw a conclusion from",
  );
  assert.equal(
    isUnconvertedProject({ views: enough, inquiries: 1, totalInquiries: 4 }),
    false,
    "it did convert",
  );
  assert.equal(
    isUnconvertedProject({ views: enough * 10, inquiries: 0, totalInquiries: 0 }),
    false,
    "with no enquiries anywhere, the form is the problem, not this project",
  );
});
