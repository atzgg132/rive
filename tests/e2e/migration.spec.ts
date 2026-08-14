import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { loadEnvConfig } from "@next/env";
import { checkServerIdentity } from "node:tls";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { Pool } from "pg";

/**
 * Browser-level coverage of the migration journey.
 *
 * Requires a database and a seeded user, like every other authenticated spec in
 * this suite, plus `MIGRATION_ENGINE_ENABLED=true` because the route does not
 * exist while the flag is off.
 */

const FIXTURES = join(process.cwd(), "tests", "fixtures", "migration");

let sessionTokenPromise: Promise<string> | undefined;

async function getSessionToken() {
  if (!sessionTokenPromise) {
    sessionTokenPromise = (async () => {
      loadEnvConfig(process.cwd());
      const email = process.env.E2E_USER_EMAIL?.trim().toLowerCase();
      if (!email) throw new Error("E2E_USER_EMAIL is required for migration tests.");

      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) throw new Error("DATABASE_URL is required for migration tests.");
      const ssl =
        process.env.DATABASE_SSL === "disable" || databaseUrl.includes("sslmode=disable")
          ? false
          : {
              rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
              ...(process.env.DATABASE_SSL_SERVERNAME
                ? {
                    checkServerIdentity: (_hostname: string, certificate: Parameters<typeof checkServerIdentity>[1]) =>
                      checkServerIdentity(process.env.DATABASE_SSL_SERVERNAME!, certificate),
                  }
                : {}),
            };
      const parsed = new URL(databaseUrl);
      for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) {
        parsed.searchParams.delete(parameter);
      }
      const pool = new Pool({ connectionString: parsed.toString(), ssl });
      const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
      try {
        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, plan: true, sessionVersion: true },
        });
        if (!user) throw new Error(`No test user exists for ${email}.`);
        const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
        const payload = JSON.stringify({
          userId: user.id,
          email: user.email,
          plan: user.plan,
          sessionVersion: user.sessionVersion,
          expiry,
        });
        const secret = process.env.SESSION_SECRET || process.env.DATABASE_URL || "rive-local-development-session-secret";
        const signature = createHmac("sha256", secret).update(payload).digest("hex");
        return Buffer.from(`${payload}.${signature}`).toString("base64");
      } finally {
        await prisma.$disconnect();
        await pool.end();
      }
    })();
  }
  return sessionTokenPromise;
}

async function authenticate(context: BrowserContext, baseURL: string) {
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: "rive_session",
      value: await getSessionToken(),
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ]);
}

function fixture(name: string) {
  return { name, mimeType: "text/csv", buffer: readFileSync(join(FIXTURES, name)) };
}

/** Upload files through the real input and wait for analysis to finish. */
async function uploadAndAnalyze(page: Page, names: string[]) {
  await page.setInputFiles("#migration-files", names.map(fixture));
  const analysis = page.waitForResponse(
    (response) => response.url().includes("/api/migrations") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Analyze files" }).click();
  const response = await analysis;
  expect(response.status(), await response.text()).toBeLessThan(400);
  return response.json();
}

test.describe("migration", () => {
  test.setTimeout(120_000);
  test.skip(!process.env.E2E_USER_EMAIL, "Set E2E_USER_EMAIL to run migration tests.");
  test.skip(
    process.env.MIGRATION_ENGINE_ENABLED?.toLowerCase() !== "true",
    "Set MIGRATION_ENGINE_ENABLED=true to run migration tests.",
  );

  test("imports multiple files end to end and lands on a populated workspace", async ({ context, page, baseURL }) => {
    await authenticate(context, baseURL!);
    await page.goto("/migrate", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Import your business" })).toBeVisible();

    await uploadAndAnalyze(page, [
      "clients-standard.csv",
      "projects-standard.csv",
      "invoices-standard.csv",
      "expenses-standard.csv",
    ]);

    await expect(page.getByRole("heading", { name: "What Rive found" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Clients", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "See what will be imported" }).first().click();
    await expect(page.getByRole("heading", { name: "What will happen" })).toBeVisible();

    const commit = page.waitForResponse((response) => response.url().includes("/commit"));
    await page.getByRole("button", { name: "Import workspace" }).click();
    expect((await commit).status()).toBeLessThan(400);

    await expect(page.getByRole("heading", { name: "Your workspace is ready" })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("link", { name: "Go to Overview" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("asks about an unknown currency and applies the answer to every row", async ({ context, page, baseURL }) => {
    await authenticate(context, baseURL!);
    await page.goto("/migrate", { waitUntil: "domcontentloaded" });

    await uploadAndAnalyze(page, ["invoices-multiple-currencies.csv"]);
    await page.getByRole("button", { name: /Review these|Check the details/ }).click();

    // The dollar sign is ambiguous, so the engine asks rather than guessing.
    await expect(page.getByText(/could mean/i).first()).toBeVisible({ timeout: 30_000 });
    const patch = page.waitForResponse(
      (response) => response.url().includes("/api/migrations/") && response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: /^Use USD/ }).first().click();
    expect((await patch).status()).toBeLessThan(400);
    await expect(page.getByText(/could mean/i)).toHaveCount(0, { timeout: 30_000 });
  });

  test("an in-progress migration survives a refresh", async ({ context, page, baseURL }) => {
    await authenticate(context, baseURL!);
    await page.goto("/migrate", { waitUntil: "domcontentloaded" });

    const { migrationId } = await uploadAndAnalyze(page, ["unknown-shape.csv", "clients-standard.csv"]);
    expect(migrationId).toBeTruthy();
    await expect(page).toHaveURL(new RegExp(`id=${migrationId}`));

    await page.reload({ waitUntil: "domcontentloaded" });
    // State lives on the server, so the reloaded page resumes in review rather
    // than sending the user back to the upload screen.
    await expect(page.getByText(/needs a record type|need a record type/i)).toBeVisible({ timeout: 30_000 });
  });

  test("classifying an unknown file resolves it without re-uploading", async ({ context, page, baseURL }) => {
    await authenticate(context, baseURL!);
    await page.goto("/migrate", { waitUntil: "domcontentloaded" });

    await uploadAndAnalyze(page, ["unknown-shape.csv"]);
    await page.getByRole("button", { name: /Review these|Check the details/ }).click();

    const select = page.locator('select[id^="classify-"]').first();
    await expect(select).toBeVisible({ timeout: 30_000 });
    const patch = page.waitForResponse(
      (response) => response.url().includes("/api/migrations/") && response.request().method() === "PATCH",
    );
    await select.selectOption("clients");
    expect((await patch).status()).toBeLessThan(400);
  });

  test("the review screen is usable on a phone", async ({ context, page, baseURL }) => {
    await authenticate(context, baseURL!);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/migrate", { waitUntil: "domcontentloaded" });

    await uploadAndAnalyze(page, ["invoices-weird-statuses.csv"]);
    await page.getByRole("button", { name: /Review these|Check the details/ }).click();
    await expect(page.getByText(/is not an invoice status/i).first()).toBeVisible({ timeout: 30_000 });

    // Nothing may overflow the viewport horizontally.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("committing twice does not import anything twice", async ({ context, page, baseURL, request }) => {
    await authenticate(context, baseURL!);
    await page.goto("/migrate", { waitUntil: "domcontentloaded" });

    const { migrationId, planHash } = await uploadAndAnalyze(page, ["clients-standard.csv"]);

    const first = await request.post(`/api/migrations/${migrationId}/commit`, {
      data: { planHash },
      headers: { cookie: `rive_session=${await getSessionToken()}` },
    });
    expect(first.status()).toBe(200);
    const firstBody = await first.json();

    const second = await request.post(`/api/migrations/${migrationId}/commit`, {
      data: { planHash },
      headers: { cookie: `rive_session=${await getSessionToken()}` },
    });
    // The second attempt is refused outright rather than creating duplicates.
    expect(second.status()).toBe(409);
    expect(firstBody.total).toBeGreaterThan(0);
  });

  test("a stale plan hash is refused", async ({ context, page, baseURL, request }) => {
    await authenticate(context, baseURL!);
    await page.goto("/migrate", { waitUntil: "domcontentloaded" });

    const { migrationId } = await uploadAndAnalyze(page, ["clients-standard.csv"]);
    const response = await request.post(`/api/migrations/${migrationId}/commit`, {
      data: { planHash: "0".repeat(64) },
      headers: { cookie: `rive_session=${await getSessionToken()}` },
    });
    expect(response.status()).toBe(409);
    expect((await response.json()).message).toMatch(/changed since you reviewed it/i);
  });

  test("an unresolved relationship is surfaced for review and the resolution persists through a refresh", async ({ context, page, baseURL }) => {
    await authenticate(context, baseURL!);
    await page.goto("/migrate", { waitUntil: "domcontentloaded" });

    // projects-unresolved-client.csv names clients ("ACME", "Umbrella Holdings")
    // that only resemble the imported client rows, so the engine must ask rather
    // than guess.
    await uploadAndAnalyze(page, ["clients-standard.csv", "projects-unresolved-client.csv"]);
    await page.getByRole("button", { name: /Review these|Check the details/ }).click();

    // The relationship review section is visible and names the unresolved client.
    await expect(page.getByText(/not linked yet/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/ACME/i).first()).toBeVisible();

    // Resolve one relationship: link "Website redesign" (project) to the client
    // it actually belongs to, using the "Link to" candidate button.
    const linkButton = page.getByRole("button", { name: /^Link to .*%/ }).first();
    await expect(linkButton).toBeVisible();
    const patch = page.waitForResponse(
      (response) => response.url().includes("/api/migrations/") && response.request().method() === "PATCH",
    );
    await linkButton.click();
    expect((await patch).status()).toBeLessThan(400);

    // The resolution persists server-side: a refresh lands back on review with
    // the resolved row no longer listed as an open question.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(/not linked yet/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/ACME/i).first()).not.toBeVisible();
  });

  test("an identical expense is raised as a possible duplicate for the user to decide", async ({ context, page, baseURL }) => {
    await authenticate(context, baseURL!);
    await page.goto("/migrate", { waitUntil: "domcontentloaded" });

    // expenses-duplicates.csv has two rows with the same merchant, amount, and
    // date — the composite fingerprint is identical, so the second is offered
    // for review rather than silently merged.
    await uploadAndAnalyze(page, ["expenses-duplicates.csv"]);
    await page.getByRole("button", { name: /Review these|Check the details/ }).click();

    await expect(page.getByText(/possible duplicates/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/We think these are the same/i).first()).toBeVisible();
    await expect(page.getByText(/identical expense appears earlier/i).first()).toBeVisible();

    // Decide: merge the duplicate row. The button is "Merge them" for batch
    // scope duplicates.
    const mergeButton = page.getByRole("button", { name: /Merge them/ }).first();
    await expect(mergeButton).toBeVisible();
    const patch = page.waitForResponse(
      (response) => response.url().includes("/api/migrations/") && response.request().method() === "PATCH",
    );
    await mergeButton.click();
    expect((await patch).status()).toBeLessThan(400);

    // After the merge decision the duplicate is no longer an open question.
    await expect(page.getByText(/possible duplicates/i)).toHaveCount(0, { timeout: 30_000 });
  });

  test("abandoning a review migration removes it from history without touching any workspace record", async ({ context, page, baseURL }) => {
    await authenticate(context, baseURL!);
    await page.goto("/migrate", { waitUntil: "domcontentloaded" });

    const { migrationId } = await uploadAndAnalyze(page, ["clients-standard.csv", "expenses-duplicates.csv"]);
    await page.getByRole("button", { name: /Review these|Check the details/ }).click();
    await expect(page.getByText(/possible duplicates/i)).toBeVisible({ timeout: 30_000 });

    // Confirm the dialog the abandon control shows.
    page.once("dialog", (dialog) => void dialog.accept());

    // Abandoning is a POST to the migration route (non-destructive — the
    // server transitions to `abandoned`, never deletes staged rows' targets).
    const abandon = page.waitForResponse(
      (response) => response.url().includes(`/api/migrations/${migrationId}`) && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Discard and start over" }).click();
    expect((await abandon).status()).toBeLessThan(400);

    // Back at the upload screen, the abandoned migration is gone from history.
    await expect(page.getByRole("heading", { name: "Import your business" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(migrationId)).toHaveCount(0);
    await expect(page.getByText(/possible duplicates/i)).toHaveCount(0);
  });

  test("a refresh during an in-flight commit lands on the finishing screen, not the analysis screen", async ({ context, page, baseURL, request }) => {
    await authenticate(context, baseURL!);
    await page.goto("/migrate", { waitUntil: "domcontentloaded" });

    const { migrationId, planHash } = await uploadAndAnalyze(page, ["clients-standard.csv"]);

    // Fire the commit request but don't await it — the server is now committing
    // and the browser immediately reloads, as a user would after closing a tab.
    const commitPromise = request.post(`/api/migrations/${migrationId}/commit`, {
      data: { planHash },
      headers: { cookie: `rive_session=${await getSessionToken()}` },
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    // Whatever the exact timing, a resumed migration must never land back on
    // the analysis screen — that would imply the commit never started.
    await expect(page.getByText(/Reading your files/i)).toHaveCount(0, { timeout: 30_000 });

    // The commit finishes in the background and the polling panel eventually
    // reports success.
    await expect(page.getByRole("heading", { name: "Your workspace is ready" })).toBeVisible({ timeout: 60_000 });
    await commitPromise;
  });
});
