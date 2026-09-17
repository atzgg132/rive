import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { NextRequest } from "next/server";

import { prisma } from "../helpers/prisma-mock.mjs";
import { POST } from "../../src/app/api/internal/email-events/route.ts";
import { parseProviderEmailEvent } from "../../src/utils/emailEvents.ts";

beforeEach(() => {
  prisma.__reset();
});

function request(payload, authorized = true) {
  return new NextRequest("http://localhost/api/internal/email-events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorized ? { authorization: "Bearer test-cron-secret" } : {}),
    },
    body: JSON.stringify(payload),
  });
}

function sesEvent(eventType = "BOUNCE") {
  return {
    eventType,
    mail: {
      messageId: "ses-message-1",
      destination: ["Bounced@Example.com"],
    },
    bounce: {
      bounceType: "Permanent",
      bounceSubType: "General",
      diagnosticCode: "smtp; 550 5.1.1 <bounced@example.com> rejected",
    },
  };
}

test("SES event parser normalizes failure details and recipients", () => {
  const event = parseProviderEmailEvent(sesEvent());

  assert.equal(event.kind, "BOUNCE");
  assert.equal(event.messageId, "ses-message-1");
  assert.deepEqual(event.recipients, ["bounced@example.com"]);
  assert.equal(event.status, "delivery_failed");
  assert.equal(event.suppressRecipients, true);
  assert.ok(!event.reason.includes("bounced@example.com"));
});

test("provider bounce updates delivery state and suppresses the recipient", async () => {
  const priorSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-cron-secret";
  try {
    prisma.__db.emailDelivery.push({ id: "delivery-1", recipient: "bounced@example.com", type: "invoice_sent", status: "sent", providerMessageId: "ses-message-1", error: null });
    prisma.__db.invoiceDelivery.push({ id: "invoice-delivery-1", invoiceId: "invoice-1", status: "sent", providerMessageId: "ses-message-1", error: null });

    const response = await POST(request(sesEvent()));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.deliveryRecords, 1);
    assert.equal(body.invoiceDeliveryRecords, 1);
    assert.equal(prisma.__db.emailDelivery[0].status, "delivery_failed");
    assert.equal(prisma.__db.invoiceDelivery[0].status, "delivery_failed");
    assert.equal(prisma.__db.emailSuppression[0].email, "bounced@example.com");
    assert.equal(prisma.__db.emailSuppression[0].source, "ses");
  } finally {
    if (priorSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = priorSecret;
  }
});

test("a delayed delivery event does not reopen a terminal provider failure", async () => {
  const priorSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-cron-secret";
  try {
    prisma.__db.emailDelivery.push({ id: "delivery-1", recipient: "bounced@example.com", type: "invoice_sent", status: "delivery_failed", providerMessageId: "ses-message-1", error: "bounce" });
    prisma.__db.invoiceDelivery.push({ id: "invoice-delivery-1", invoiceId: "invoice-1", status: "delivery_failed", providerMessageId: "ses-message-1", error: "bounce" });

    const response = await POST(request(sesEvent("DELIVERY")));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.deliveryRecords, 0);
    assert.equal(body.invoiceDeliveryRecords, 0);
    assert.equal(prisma.__db.emailDelivery[0].status, "delivery_failed");
    assert.equal(prisma.__db.invoiceDelivery[0].status, "delivery_failed");
  } finally {
    if (priorSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = priorSecret;
  }
});

test("provider events require the internal bearer secret", async () => {
  const priorSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-cron-secret";
  try {
    const response = await POST(request(sesEvent(), false));
    assert.equal(response.status, 401);
  } finally {
    if (priorSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = priorSecret;
  }
});
