import nextEnv from "@next/env";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkServerIdentity } from "node:tls";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const configuredBaseUrl = process.env.CONTRACT_SMOKE_BASE_URL?.trim().replace(/\/$/, "") || "";
const port = 3100;
const baseUrl = configuredBaseUrl || `http://127.0.0.1:${port}`;
const runId = `${Date.now()}-${process.pid}`;
const progressLog = join(tmpdir(), `rive-contract-smoke-${runId}.log`);
const fixtureEmail = `contract-smoke-${runId}@example.invalid`;
const clientEmail = `contract-client-${runId}@example.invalid`;
const contractTitle = `Smoke contract ${runId}`;

if (process.env.CONTRACT_SMOKE_SERVER === "production") {
  process.env.APP_URL = baseUrl;
  process.env.APP_ENV = "dev";
  process.env.SESSION_SECRET = "contract-smoke-session-" + runId;
  process.env.CALENDAR_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.CRON_SECRET = "contract-smoke-cron-" + runId;
}

let prisma;
let pool;
let server;
let fixtureUserId;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function progress(message) {
  const line = `[contract-smoke] ${new Date().toISOString()} ${message}`;
  appendFileSync(progressLog, `${line}\n`);
  console.log(line);
}

function safePath(path) {
  return path.replace(/\/(review|sign|artifact)\/[^/]+/g, "/$1/<token>");
}

function apiPath(url, resource) {
  const token = new URL(url, baseUrl).pathname.split("/").filter(Boolean).pop();
  assert(token, `Missing ${resource} token.`);
  return `/api/public/contracts/${resource}/${encodeURIComponent(token)}`;
}

function sessionToken(user) {
  const expiry = Date.now() + 60 * 60 * 1000;
  const payload = JSON.stringify({ userId: user.id, email: user.email, plan: user.plan, expiry });
  const secret = process.env.SESSION_SECRET || process.env.DATABASE_URL || "rive-user-secret-salt-9876";
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64");
}

function createDatabaseClient() {
  assert(process.env.DATABASE_URL, "DATABASE_URL is missing inside the dev tunnel.");
  const parsed = new URL(process.env.DATABASE_URL);
  for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) parsed.searchParams.delete(parameter);
  const sslDisabled = process.env.DATABASE_SSL === "disable";
  const sslServerName = process.env.DATABASE_SSL_SERVERNAME || "";
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true";
  pool = new Pool({
    connectionString: parsed.toString(),
    max: 4,
    connectionTimeoutMillis: 10_000,
    ssl: sslDisabled
      ? false
      : {
          rejectUnauthorized,
          ...(sslServerName
            ? { checkServerIdentity: (_hostname, certificate) => checkServerIdentity(sslServerName, certificate) }
            : {}),
        },
  });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
}

async function waitForServer() {
  const deadline = Date.now() + 90_000;
  let lastError = "server did not start";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/session`, { signal: AbortSignal.timeout(2_000) });
      if (response.status < 500) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Next.js dev server did not become ready: ${lastError}`);
}

function startServer() {
  const isWindows = process.platform === "win32";
  const productionServer = process.env.CONTRACT_SMOKE_SERVER === "production";
  const npmScript = productionServer ? "start" : "dev";
  const command = isWindows ? process.env.ComSpec || "cmd.exe" : "npm";
  const args = isWindows
    ? ["/d", "/s", "/c", `npm run ${npmScript} -- --hostname 127.0.0.1 --port ${port}`]
    : ["run", npmScript, "--", "--hostname", "127.0.0.1", "--port", String(port)];
  const env = {
    ...process.env,
    APP_URL: baseUrl,
    CONTRACTS_ENABLED: "true",
    EMAIL_PROVIDER: "disabled",
    ESIGN_PROVIDER: process.env.CONTRACT_SMOKE_ESIGN_PROVIDER || "local",
    NODE_ENV: productionServer ? "production" : "development",
  };
  server = spawn(command, args, {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  server.stdout?.on("data", (chunk) => {
    if (process.env.CONTRACT_SMOKE_VERBOSE === "true") process.stdout.write(chunk);
  });
  server.stderr?.on("data", (chunk) => {
    if (process.env.CONTRACT_SMOKE_VERBOSE === "true") process.stderr.write(chunk);
  });
  server.on("error", (error) => {
    if (!server?.exitCode) console.error(`Smoke server error: ${error.message}`);
  });
}

async function stopServer() {
  if (!server) return;
  const child = server;
  if (process.platform === "win32" && child.pid) {
    const killer = spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `taskkill /pid ${child.pid} /t /f`], { stdio: "ignore", windowsHide: true });
    await new Promise((resolve) => killer.once("exit", resolve));
  } else if (child.exitCode === null && !child.killed) {
    child.kill();
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  server = undefined;
}

async function request(path, { method = "GET", body, authenticated = true, headers = {} } = {}) {
  progress(`request ${method} ${safePath(path)}`);
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(authenticated ? { cookie: `rive_session=${session}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  progress(`response ${method} ${safePath(path)} ${response.status}`);
  return { response, payload, text };
}

function expectStatus(result, status, label) {
  assert(result.response.status === status, `${label}: expected HTTP ${status}, got ${result.response.status} (${result.payload?.message || result.text.slice(0, 240)})`);
}

async function expectJson(path, options, status, label) {
  const result = await request(path, options);
  expectStatus(result, status, label);
  assert(result.payload?.success === true, `${label}: response did not report success.`);
  return result.payload;
}

async function cleanup() {
  progress("cleanup started");
  await stopServer();
  if (!prisma) return;
  try {
    if (fixtureUserId) {
      await prisma.contract.deleteMany({ where: { userId: fixtureUserId } });
      await prisma.invoice.deleteMany({ where: { userId: fixtureUserId } });
      await prisma.project.deleteMany({ where: { userId: fixtureUserId } });
      await prisma.client.deleteMany({ where: { userId: fixtureUserId } });
      await prisma.user.delete({ where: { id: fixtureUserId } });
    }
  } finally {
    await prisma.$disconnect();
    await pool?.end();
    progress("cleanup finished");
  }
}

let session;

async function main() {
  createDatabaseClient();

  const user = await prisma.user.create({
    data: {
      email: fixtureEmail,
      name: "Contract Smoke Owner",
      passwordHash: "smoke-only",
      plan: "pro",
      onboardingStatus: "complete",
      onboardingStep: 5,
      businessType: "freelancer",
      profession: "Product designer",
      currency: "INR",
      timeZone: "Asia/Kolkata",
    },
  });
  fixtureUserId = user.id;
  session = sessionToken(user);

  const client = await prisma.client.create({
    data: {
      userId: user.id,
      name: "Contract Smoke Client",
      email: clientEmail,
      company: "Smoke Client Pvt Ltd",
      address: "Bengaluru, Karnataka",
      status: "active",
      tags: ["smoke"],
    },
  });
  const project = await prisma.project.create({
    data: {
      userId: user.id,
      clientId: client.id,
      title: "Contract smoke project",
      description: "A project brief reused by the contract integration smoke test.",
      status: "active",
      currency: "INR",
      budget: 600,
      tags: ["smoke"],
    },
  });
  const milestoneCompleted = await prisma.milestone.create({ data: { projectId: project.id, title: "Approved milestone", dueDate: new Date(Date.now() + 5 * 86400000) } });
  const milestoneDue = await prisma.milestone.create({ data: { projectId: project.id, title: "Due milestone", dueDate: new Date(Date.now() - 60_000) } });
  const fixtureCount = await prisma.user.count({ where: { id: user.id } });
  progress(`fixture created in ${new URL(process.env.DATABASE_URL).pathname} (visible=${fixtureCount === 1})`);

  if (!configuredBaseUrl) startServer();
  await waitForServer();
  progress("Next server ready");

  const clients = await expectJson("/api/workflow/clients", undefined, 200, "existing clients integration");
  assert(clients.clients.some((item) => item.id === client.id && item.email === clientEmail), "Client list did not expose the existing client record.");
  const projects = await expectJson("/api/workflow/projects", undefined, 200, "existing projects integration");
  const listedProject = projects.projects.find((item) => item.id === project.id);
  assert(listedProject?.currency === "INR" && listedProject.milestones.length === 2, "Project list did not expose its existing milestones/currency.");
  assert(listedProject.contract_coverage === "undecided", "A new project did not start with an explicit undecided contract state.");
  const externalCoverage = await expectJson(`/api/workflow/projects/${project.id}/contract-coverage`, { method: "PATCH", body: { coverage: "external", externalLabel: "Client MSA", externalUrl: "https://example.com/contracts/client-msa" } }, 200, "external contract coverage");
  assert(externalCoverage.coverage.status === "external" && externalCoverage.coverage.external_url?.startsWith("https://example.com/"), "External contract metadata was not retained.");
  progress("client and project reuse verified");

  const paymentPlan = [
    { label: "Signing deposit", amount: 100, currency: "INR", triggerType: "on_signing", dueDays: 7, milestoneId: null, triggerDate: null },
    { label: "Approved milestone fee", amount: 200, currency: "INR", triggerType: "milestone_completed", dueDays: 7, milestoneId: milestoneCompleted.id, triggerDate: null },
    { label: "Due milestone fee", amount: 300, currency: "INR", triggerType: "milestone_due", dueDays: 7, milestoneId: milestoneDue.id, triggerDate: null },
  ];
  const created = await expectJson("/api/workflow/contracts", { method: "POST", body: { title: contractTitle, clientId: client.id, projectId: project.id, currency: "INR", governingLaw: "India", jurisdiction: "Bengaluru, Karnataka", paymentPlan } }, 201, "contract creation");
  const contractId = created.contractId;
  let detail = await expectJson(`/api/workflow/contracts/${contractId}`, undefined, 200, "contract detail after creation");
  const content = detail.contract.versions[0].content;
  assert(content.ownerName === user.name && content.ownerEmail === user.email, "Owner identity was not reused from the workspace user.");
  assert(content.clientName === client.name && content.clientEmail === client.email, "Client identity was not reused from the existing client.");
  assert(content.clientCompany === client.company && content.clientAddress === client.address, "Client company/address were not reused in the contract snapshot.");
  assert(content.projectTitle === project.title && content.projectDescription === project.description, "Project title/brief were not reused in the contract snapshot.");
  assert(content.governingLaw === "India" && content.jurisdiction === "Bengaluru, Karnataka", "Governing law/jurisdiction were not included in the immutable version snapshot.");
  assert(content.paymentPlan.items.length === 3, "Payment plan was not snapshotted into the contract version.");
  assert(content.paymentPlan.items.find((item) => item.triggerType === "milestone_due")?.triggerDate?.slice(0, 10) === milestoneDue.dueDate.toISOString().slice(0, 10), "Milestone due-date billing was not anchored to the agreed date.");
  assert(content.sections.some((section) => section.key === "confidentiality" && section.enabled === false), "Optional clause customization was not preserved.");
  const projectAfterContract = (await expectJson("/api/workflow/projects", undefined, 200, "project coverage after Rive contract")).projects.find((item) => item.id === project.id);
  assert(projectAfterContract?.contract_coverage === "rive" && projectAfterContract.external_contract_url === null, "Creating a Rive contract did not replace the external coverage decision.");
  progress("contract snapshot and clause defaults verified");

  const firstReview = await expectJson(`/api/workflow/contracts/${contractId}/review`, { method: "POST", body: { sendEmail: false } }, 200, "review link creation");
  const firstReviewPath = apiPath(firstReview.reviewUrl, "review");
  const publicReview = await expectJson(firstReviewPath, { authenticated: false }, 200, "public review fetch");
  assert(publicReview.contract.content.clientEmail === client.email, "Public review did not show the snapshotted client data.");
  assert(publicReview.contract.governing_law === "India" && publicReview.contract.jurisdiction === "Bengaluru, Karnataka", "Public review did not show the snapshotted legal venue.");
  const publicComment = await expectJson(firstReviewPath, { method: "POST", authenticated: false, body: { authorName: client.name, authorEmail: client.email, sectionKey: "fees", body: "Please confirm the invoice due period." } }, 201, "public review comment");
  detail = await expectJson(`/api/workflow/contracts/${contractId}`, undefined, 200, "owner comment visibility");
  assert(detail.contract.comments.some((comment) => comment.id === publicComment.comment.id), "Public comment was not visible to the owner.");
  const notifications = await expectJson("/api/notifications", undefined, 200, "comment notification");
  assert(notifications.notifications.some((notification) => notification.type === "contract_comment"), "Comment notification was not created.");
  progress("public review and notification verified");

  const editedSections = detail.contract.versions[0].content.sections.map((section) => section.key === "confidentiality" ? { ...section, enabled: true } : section);
  await expectJson(`/api/workflow/contracts/${contractId}`, { method: "PUT", body: { title: contractTitle, currency: "INR", governingLaw: "India", jurisdiction: "Bengaluru, Karnataka", sections: editedSections.filter((section) => section.key !== "electronic-signatures"), paymentPlan } }, 200, "contract version edit");
  detail = await expectJson(`/api/workflow/contracts/${contractId}`, undefined, 200, "required signing clause recovery");
  assert(detail.contract.versions[0].content.sections.some((section) => section.key === "electronic-signatures" && section.enabled && section.required), "The electronic-signatures clause could be removed from a crafted edit payload.");
  const revokedReview = await request(firstReviewPath, { authenticated: false });
  expectStatus(revokedReview, 410, "old review link revocation");
  progress("immutable version and link revocation verified");

  const secondReview = await expectJson(`/api/workflow/contracts/${contractId}/review`, { method: "POST", body: { sendEmail: false } }, 200, "second review link creation");
  const secondReviewPath = apiPath(secondReview.reviewUrl, "review");
  const secondPublicReview = await expectJson(secondReviewPath, { authenticated: false }, 200, "second public review fetch");
  const secondComment = await expectJson(secondReviewPath, { method: "POST", authenticated: false, body: { authorName: client.name, authorEmail: client.email, sectionKey: "scope", body: "Please make sure the final scope wording is retained." } }, 201, "current-version review comment");
  const blockedFinalize = await request(`/api/workflow/contracts/${contractId}/finalize`, { method: "POST" });
  expectStatus(blockedFinalize, 409, "open comment finalization guard");
  assert(blockedFinalize.payload?.code === "OPEN_REVIEW_COMMENTS", "Finalization did not identify the open-comment conflict.");
  await expectJson(`/api/workflow/contracts/${contractId}/comments`, { method: "PATCH", body: { commentId: secondComment.comment.id, status: "resolved" } }, 200, "review comment resolution");
  await expectJson(secondReviewPath, { method: "POST", authenticated: false, body: { action: "approve", authorName: client.name, authorEmail: client.email } }, 200, "client review approval");
  const approvedReview = await expectJson(secondReviewPath, { authenticated: false }, 200, "approved review fetch");
  assert(approvedReview.mode === "read_only" && approvedReview.contract.version.status === "approved", "Client approval did not lock the reviewed version.");
  const commentAfterApproval = await request(secondReviewPath, { method: "POST", authenticated: false, body: { authorName: client.name, body: "This should be closed." } });
  expectStatus(commentAfterApproval, 409, "approved review comment guard");
  assert(secondPublicReview.contract.version.hash === approvedReview.contract.version.hash, "Review approval changed the contract document hash.");
  await expectJson(`/api/workflow/contracts/${contractId}/finalize`, { method: "POST" }, 200, "contract finalization");

  const firstSigning = await expectJson(`/api/workflow/contracts/${contractId}/start-signing`, { method: "POST" }, 200, "first signing start");
  const firstClientSignPath = apiPath(firstSigning.clientSignUrl, "sign");
  const firstOwnerSignPath = apiPath(firstSigning.ownerSignUrl, "sign");
  const signingPage = await expectJson(firstClientSignPath, { authenticated: false }, 200, "client signing consent page");
  assert(signingPage.consent?.version && signingPage.consent?.text?.includes("typed-name acceptance") && signingPage.consent?.text?.includes("not an OTP"), "Signing page did not expose the versioned consent text.");
  const ownerEarly = await request(firstOwnerSignPath, { method: "POST", authenticated: false, body: { typedName: user.name, consentAccepted: true } });
  expectStatus(ownerEarly, 400, "owner cannot sign before client");
  const firstClientSign = await expectJson(firstClientSignPath, { method: "POST", authenticated: false, body: { typedName: client.name, consentAccepted: true } }, 200, "first client signature");
  assert(firstClientSign.completed === false, "Client signature incorrectly executed the two-party contract alone.");
  await expectJson(firstOwnerSignPath, { method: "POST", authenticated: false, body: { action: "decline", reason: "The final signer needs one wording correction before execution." } }, 200, "owner decline after partial signature");
  detail = await expectJson(`/api/workflow/contracts/${contractId}`, undefined, 200, "declined partial-signature detail");
  assert(detail.contract.status === "declined" && detail.contract.signers.some((signer) => signer.signatures.some((signature) => signature.versionId === detail.contract.versions[0].id)), "Partial signature evidence was not retained on the declined version.");
  const declinedOldLink = await request(firstClientSignPath, { authenticated: false });
  expectStatus(declinedOldLink, 410, "declined signing link revocation");

  await expectJson(`/api/workflow/contracts/${contractId}`, { method: "PUT", body: { title: contractTitle, currency: "INR", governingLaw: "India", jurisdiction: "Bengaluru, Karnataka", sections: detail.contract.versions[0].content.sections, paymentPlan } }, 200, "new version after partial signature decline");
  detail = await expectJson(`/api/workflow/contracts/${contractId}`, undefined, 200, "replacement version detail");
  assert(detail.contract.status === "draft" && detail.contract.versions[0].version === 3, "Declined contract did not recover through a new immutable version.");
  await expectJson(`/api/workflow/contracts/${contractId}/finalize`, { method: "POST" }, 200, "replacement version finalization");
  const signing = await expectJson(`/api/workflow/contracts/${contractId}/start-signing`, { method: "POST" }, 200, "replacement signing start");
  const originalClientSignPath = apiPath(signing.clientSignUrl, "sign");
  const ownerSignPath = apiPath(signing.ownerSignUrl, "sign");
  const reissuedClient = await expectJson(`/api/workflow/contracts/${contractId}/signing-links`, { method: "POST", body: { role: "client", sendEmail: false } }, 200, "client signing link reissue");
  const clientSignPath = apiPath(reissuedClient.signUrl, "sign");
  const revokedOriginalClient = await request(originalClientSignPath, { authenticated: false });
  expectStatus(revokedOriginalClient, 410, "reissued signing link revocation");
  const clientSign = await expectJson(clientSignPath, { method: "POST", authenticated: false, body: { typedName: client.name, consentAccepted: true } }, 200, "replacement client signature");
  assert(clientSign.completed === false, "Replacement client signature incorrectly executed the two-party contract alone.");
  const ownerSign = await expectJson(ownerSignPath, { method: "POST", authenticated: false, body: { typedName: user.name, consentAccepted: true } }, 200, "owner signature and execution");
  assert(ownerSign.completed === true && ownerSign.downloadUrl, "Owner signature did not complete the contract or issue an artifact link.");
  progress("review approval, decline recovery, link reissue, and two-party execution verified");

  const executed = await expectJson(`/api/workflow/contracts/${contractId}`, undefined, 200, "executed contract detail");
  assert(executed.contract.status === "executed", "Contract did not reach executed status.");
  assert(executed.contract.signers.every((signer) => signer.status === "signed"), "Both named signers were not recorded as signed.");
  const ownerArtifact = await request(`/api/workflow/contracts/${contractId}/artifact`);
  expectStatus(ownerArtifact, 200, "owner executed PDF");
  assert(ownerArtifact.response.headers.get("content-type")?.includes("application/pdf") && ownerArtifact.text.length > 0, "Owner executed PDF was empty or had the wrong content type.");
  const publicArtifact = await request(new URL(ownerSign.downloadUrl, baseUrl).pathname, { authenticated: false });
  expectStatus(publicArtifact, 200, "public executed PDF");
  assert(publicArtifact.response.headers.get("x-contract-document-hash"), "Public PDF did not expose the document hash evidence header.");
  assert(publicArtifact.response.headers.get("x-contract-evidence-hash") && publicArtifact.response.headers.get("x-contract-evidence-hash") !== publicArtifact.response.headers.get("x-contract-document-hash"), "Public PDF did not expose a distinct execution evidence hash.");
  progress("executed PDFs and evidence headers verified");

  const signingInvoiceCount = (await expectJson("/api/workflow/invoices", undefined, 200, "automatic signing invoice list")).invoices.filter((invoice) => invoice.client_id === client.id && invoice.project_id === project.id && invoice.notes?.includes(contractTitle));
  assert(signingInvoiceCount.length === 2 && signingInvoiceCount.every((invoice) => invoice.status === "draft"), "Execution did not create exactly the signing and already-due reviewable invoice drafts.");
  const approvedUpdate = await expectJson(`/api/workflow/milestones/${milestoneCompleted.id}`, { method: "PATCH", body: { completed: true } }, 200, "completed milestone update");
  assert(approvedUpdate.billing?.drafted === 1, "Completing a milestone did not create its invoice draft.");
  const completionReversal = await request(`/api/workflow/milestones/${milestoneCompleted.id}`, { method: "PATCH", body: { completed: false } });
  expectStatus(completionReversal, 409, "invoice-triggering completion reversal guard");
  const unacknowledgedScheduleChange = await request(`/api/workflow/milestones/${milestoneDue.id}`, { method: "PATCH", body: { dueDate: new Date(Date.now() + 10 * 86400000).toISOString() } });
  expectStatus(unacknowledgedScheduleChange, 409, "contract milestone schedule acknowledgement guard");
  const dueUpdate = await expectJson(`/api/workflow/milestones/${milestoneDue.id}`, { method: "PATCH", body: { dueDate: new Date(Date.now() + 10 * 86400000).toISOString(), acknowledgeContractSnapshot: true } }, 200, "acknowledged project schedule change");
  assert(dueUpdate.billing?.drafted === 0, "Changing the live project date regenerated a contract invoice or rewrote its agreed trigger.");
  const postScheduleContract = await expectJson(`/api/workflow/contracts/${contractId}`, undefined, 200, "contract snapshot after project schedule change");
  assert(postScheduleContract.contract.versions[0].content.paymentPlan.items.find((item) => item.triggerType === "milestone_due")?.triggerDate?.slice(0, 10) === milestoneDue.dueDate.toISOString().slice(0, 10), "The executed payment trigger changed with the live project milestone.");
  const billingRun = await expectJson(`/api/workflow/contracts/${contractId}/billing/run`, { method: "POST" }, 200, "idempotent billing rerun");
  assert(billingRun.drafted === 0, "Billing rerun created a duplicate invoice.");
  const maintenance = await expectJson("/api/contracts/maintenance", { method: "POST", authenticated: false, headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }, 200, "billing maintenance");
  assert(maintenance.billing?.drafted === 0, "Maintenance rerun created a duplicate invoice.");
  progress("milestone billing and idempotency verified");

  const generatedInvoices = (await expectJson("/api/workflow/invoices", undefined, 200, "generated invoice list")).invoices.filter((invoice) => invoice.client_id === client.id && invoice.project_id === project.id && invoice.notes?.includes(contractTitle));
  assert(generatedInvoices.length === 3, `Expected three generated draft invoices, found ${generatedInvoices.length}.`);
  assert(generatedInvoices.every((invoice) => invoice.status === "draft"), "Generated contract invoices must remain drafts until review and delivery succeed.");
  const changedItems = generatedInvoices[0].items.map((item, index) => ({ ...item, unit_price: index === 0 ? String(Number(item.unit_price) + 1) : item.unit_price }));
  const contractedAmountEdit = await request("/api/workflow/invoices", { method: "PUT", body: { id: generatedInvoices[0].id, items: changedItems } });
  expectStatus(contractedAmountEdit, 409, "contract-generated invoice amount guard");
  await expectJson("/api/workflow/invoices", { method: "PUT", body: { id: generatedInvoices[0].id, tax_rate: 18 } }, 200, "contract-generated invoice tax review");
  const sendAttempt = await request(`/api/workflow/invoices/${generatedInvoices[0].id}/send`, { method: "POST", body: { confirm: true } });
  assert([200, 503].includes(sendAttempt.response.status), `Invoice delivery returned unexpected HTTP ${sendAttempt.response.status}.`);
  const afterSendAttempt = (await expectJson("/api/workflow/invoices", undefined, 200, "invoice delivery state")).invoices.find((invoice) => invoice.id === generatedInvoices[0].id);
  assert(sendAttempt.response.status === 200 ? afterSendAttempt?.status === "sent" : afterSendAttempt?.status === "draft", "Invoice delivery state did not match the recorded delivery outcome.");
  const invoiceDelete = await request(`/api/workflow/invoices?id=${encodeURIComponent(generatedInvoices[0].id)}`, { method: "DELETE" });
  expectStatus(invoiceDelete, 409, "contract invoice delete guard");
  const projectUpdate = await request("/api/workflow/projects", { method: "PUT", body: { id: project.id, title: project.title, milestones: [{ title: milestoneCompleted.title }], replace_milestones: true } });
  expectStatus(projectUpdate, 409, "contract milestone project edit guard");
  const projectDelete = await request(`/api/workflow/projects?id=${encodeURIComponent(project.id)}`, { method: "DELETE" });
  expectStatus(projectDelete, 409, "contract project delete guard");
  const clientDelete = await request(`/api/workflow/clients?id=${encodeURIComponent(client.id)}`, { method: "DELETE" });
  expectStatus(clientDelete, 409, "contract client delete guard");
  progress("invoice recovery and destructive-action guards verified");

  const finalNotifications = await expectJson("/api/notifications", undefined, 200, "contract and invoice notifications");
  assert(finalNotifications.notifications.some((notification) => notification.type === "contract_executed"), "Execution notification was not created.");
  assert(finalNotifications.notifications.some((notification) => notification.type === "invoice_review" && notification.href?.includes("invoiceId=")), "Invoice review notification did not deep-link to the generated draft.");
  console.log(JSON.stringify({ success: true, checked: ["project coverage decisions", "client/project reuse", "editable clauses and immutable versions", "comments and approval", "partial-signature decline recovery", "signing-link reissue", "two-party signing", "evidence PDF", "milestone date snapshots", "invoice review locks", "delivery recovery", "idempotency", "destructive-action guards", "notifications"], generatedInvoices: generatedInvoices.length }));
}

try {
  await main();
} catch (error) {
  console.error(`Contract smoke test failed: ${error instanceof Error ? error.message : String(error)} (progress: ${progressLog})`);
  process.exitCode = 1;
} finally {
  await cleanup();
}
