import assert from "node:assert/strict";
import test from "node:test";

import { prisma } from "../helpers/prisma-mock.mjs";
import { markInquiryNotificationSettled } from "../../src/utils/portfolioInquiryNotifications.ts";

/**
 * Notification state is bookkeeping laid over an enquiry that is already safe.
 *
 * These tests pin the two properties that matter to the owner: what they see in
 * the inbox matches what actually happened to the email, and no failure in this
 * path can disturb the enquiry itself.
 */

async function seedInquiry(overrides = {}) {
  return prisma.portfolioInquiry.create({
    data: {
      portfolioId: "portfolio-1",
      userId: "user-1",
      name: "Jane Smith",
      email: "jane@company.com",
      projectType: "Website redesign",
      message: "We would like to talk about a rebuild.",
      outboxId: `outbox-${Math.random().toString(36).slice(2)}`,
      ...overrides,
    },
    select: { id: true, outboxId: true, notificationStatus: true },
  });
}

test("a delivered notification is recorded as sent and clears any earlier error", async () => {
  const inquiry = await seedInquiry();
  await markInquiryNotificationSettled(inquiry.outboxId, "sent");

  const [stored] = await prisma.portfolioInquiry.findMany({ where: { outboxId: inquiry.outboxId } });
  assert.equal(stored.notificationStatus, "sent");
  assert.equal(stored.notificationError, null);
});

test("a permanently failed notification is recorded with its reason", async () => {
  const inquiry = await seedInquiry();
  await markInquiryNotificationSettled(inquiry.outboxId, "failed", "SES rejected the recipient domain.");

  const [stored] = await prisma.portfolioInquiry.findMany({ where: { outboxId: inquiry.outboxId } });
  assert.equal(stored.notificationStatus, "failed");
  assert.equal(stored.notificationError, "SES rejected the recipient domain.");
});

test("the enquiry itself survives a failed notification untouched", async () => {
  const inquiry = await seedInquiry();
  await markInquiryNotificationSettled(inquiry.outboxId, "failed", "Provider unavailable.");

  const [stored] = await prisma.portfolioInquiry.findMany({ where: { outboxId: inquiry.outboxId } });
  assert.equal(stored.id, inquiry.id, "the lead is never dropped because mail could not be sent");
  assert.equal(stored.status, "new", "delivery trouble must not change where it sits in the inbox");
  assert.equal(stored.name, "Jane Smith");
  assert.equal(stored.message, "We would like to talk about a rebuild.");
});

test("a failure with no reason still records something the owner can act on", async () => {
  const inquiry = await seedInquiry();
  await markInquiryNotificationSettled(inquiry.outboxId, "failed", null);

  const [stored] = await prisma.portfolioInquiry.findMany({ where: { outboxId: inquiry.outboxId } });
  assert.equal(stored.notificationStatus, "failed");
  assert.ok(stored.notificationError, "an empty reason must not read as 'no problem'");
});

test("an oversized provider error is truncated rather than stored whole", async () => {
  const inquiry = await seedInquiry();
  await markInquiryNotificationSettled(inquiry.outboxId, "failed", "x".repeat(2000));

  const [stored] = await prisma.portfolioInquiry.findMany({ where: { outboxId: inquiry.outboxId } });
  assert.equal(stored.notificationError.length, 500);
});

test("settling one enquiry's notification never touches another's", async () => {
  const first = await seedInquiry();
  const second = await seedInquiry();

  await markInquiryNotificationSettled(first.outboxId, "failed", "Provider unavailable.");

  const [untouched] = await prisma.portfolioInquiry.findMany({ where: { outboxId: second.outboxId } });
  assert.equal(untouched.notificationStatus, "queued");
  assert.equal(untouched.notificationError, null);
});

test("an unknown correlation id is a no-op, not a crash", async () => {
  await assert.doesNotReject(() => markInquiryNotificationSettled("outbox-that-never-existed", "sent"));
});
