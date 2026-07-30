import "server-only";

import { prisma } from "@/utils/db";

export type WaitlistInviteStatus =
  | "not_sent"
  | "active"
  | "delivery_failed"
  | "expired"
  | "revoked"
  | "registered";

export type WaitlistOperationalDetails = {
  registered: boolean;
  registeredAt: Date | null;
  inviteStatus: WaitlistInviteStatus;
  inviteExpiresAt: Date | null;
  latestDeliveryStatus: string | null;
  latestDeliveryAt: Date | null;
};

export async function getWaitlistOperationalDetails(
  emails: string[],
): Promise<Map<string, WaitlistOperationalDetails>> {
  const normalizedEmails = [...new Set(emails.map((email) => email.trim().toLowerCase()))];
  const details = new Map<string, WaitlistOperationalDetails>();
  if (normalizedEmails.length === 0) return details;

  const [users, tokens, deliveries] = await Promise.all([
    prisma.user.findMany({
      where: { email: { in: normalizedEmails } },
      select: { email: true, createdAt: true },
    }),
    prisma.authToken.findMany({
      where: { email: { in: normalizedEmails }, type: "waitlist_invite" },
      orderBy: { createdAt: "desc" },
      select: { email: true, expiresAt: true, usedAt: true, createdAt: true },
    }),
    prisma.emailDelivery.findMany({
      where: { recipient: { in: normalizedEmails }, type: "waitlist_invite" },
      orderBy: { createdAt: "desc" },
      select: { recipient: true, status: true, createdAt: true },
    }),
  ]);

  const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const latestTokenByEmail = new Map<string, (typeof tokens)[number]>();
  const activeTokenByEmail = new Map<string, (typeof tokens)[number]>();
  const now = new Date();

  for (const token of tokens) {
    const email = token.email.toLowerCase();
    if (!latestTokenByEmail.has(email)) latestTokenByEmail.set(email, token);
    if (!activeTokenByEmail.has(email) && !token.usedAt && token.expiresAt > now) {
      activeTokenByEmail.set(email, token);
    }
  }

  const latestDeliveryByEmail = new Map<string, (typeof deliveries)[number]>();
  for (const delivery of deliveries) {
    const email = delivery.recipient.toLowerCase();
    if (!latestDeliveryByEmail.has(email)) latestDeliveryByEmail.set(email, delivery);
  }

  for (const email of normalizedEmails) {
    const user = usersByEmail.get(email);
    const activeToken = activeTokenByEmail.get(email);
    const latestToken = latestTokenByEmail.get(email);
    const latestDelivery = latestDeliveryByEmail.get(email);

    let inviteStatus: WaitlistInviteStatus = "not_sent";
    if (user) {
      inviteStatus = "registered";
    } else if (activeToken) {
      inviteStatus = "active";
    } else if (latestDelivery?.status === "failed" || latestDelivery?.status === "skipped") {
      inviteStatus = "delivery_failed";
    } else if (latestToken && !latestToken.usedAt && latestToken.expiresAt <= now) {
      inviteStatus = "expired";
    } else if (latestToken?.usedAt) {
      inviteStatus = "revoked";
    }

    details.set(email, {
      registered: Boolean(user),
      registeredAt: user?.createdAt || null,
      inviteStatus,
      inviteExpiresAt: activeToken?.expiresAt || latestToken?.expiresAt || null,
      latestDeliveryStatus: latestDelivery?.status || null,
      latestDeliveryAt: latestDelivery?.createdAt || null,
    });
  }

  return details;
}
