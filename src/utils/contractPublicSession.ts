import "server-only";

import type { NextResponse } from "next/server";
import {
  createAccessToken,
  hashAccessToken,
  type ContractPublicLinkPurpose,
} from "@/utils/contracts";

/**
 * Public contract sessions.
 *
 * Bearer links (`/sign/<token>`, `/review/<token>`, artifact URLs) are still the
 * compatibility entry points, but the first valid access exchanges the link for
 * a purpose-bound HttpOnly session cookie and the raw token leaves the address
 * bar. Only the session token hash is stored — sessions sit next to the link
 * they were minted from and never outlive it.
 *
 * The reserved `[token]` segment "session" switches the existing public API
 * routes onto the cookie instead of a URL token.
 */
export const CONTRACT_PUBLIC_SESSION_ROUTE_SEGMENT = "session";

// A session is a convenience credential for an in-progress review/acceptance,
// not a second long-lived bearer. It must never outlive the link it came from.
export const CONTRACT_PUBLIC_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// Scoped to the API surface that consumes it — the clean /sign and /review
// pages only make same-origin API calls, so the cookie never rides along on
// unrelated requests.
export const CONTRACT_PUBLIC_SESSION_COOKIE_PATH = "/api/public/contracts";

// One cookie name per purpose so a reviewer, an accepting party, and an
// artifact download can be live in the same browser without clobbering each
// other.
export const CONTRACT_PUBLIC_SESSION_COOKIE_NAMES: Record<ContractPublicLinkPurpose, string> = {
  review: "rive_contract_review_session",
  acceptance: "rive_contract_sign_session",
  artifact: "rive_contract_artifact_session",
};

export function isContractPublicSessionSegment(token: string): boolean {
  return token === CONTRACT_PUBLIC_SESSION_ROUTE_SEGMENT;
}

export function contractPublicSessionCookieName(purpose: ContractPublicLinkPurpose): string {
  return CONTRACT_PUBLIC_SESSION_COOKIE_NAMES[purpose];
}

/**
 * Minimal db surface so the helpers stay testable under the in-memory mock,
 * matching the `transitionContractStatus(db, ...)` convention.
 */
type ContractPublicSessionDb = {
  contractPublicSession: {
    findUnique(args: unknown): Promise<ContractPublicSessionRecord | null>;
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
  };
};

export type ContractPublicSessionRecord = {
  id: string;
  tokenHash: string;
  contractId: string;
  versionId: string | null;
  linkId: string;
  purpose: string;
  expiresAt: Date;
  revokedAt: Date | null;
  lastAccessedAt: Date | null;
  link?: { revokedAt: Date | null; expiresAt: Date } | null;
};

type SessionBoundLink = {
  id: string;
  contractId: string;
  versionId: string | null;
  expiresAt: Date;
};

/**
 * Mint a fresh session bound to a link. Any still-live session for the same
 * link+purpose is revoked first — re-opening a link rotates the session rather
 * than accumulating parallel credentials.
 */
export async function createContractPublicSession(
  db: ContractPublicSessionDb,
  input: { link: SessionBoundLink; purpose: ContractPublicLinkPurpose },
): Promise<{ token: string; expiresAt: Date }> {
  const token = createAccessToken();
  const now = new Date();
  const expiresAt = new Date(Math.min(now.getTime() + CONTRACT_PUBLIC_SESSION_TTL_MS, input.link.expiresAt.getTime()));
  await db.contractPublicSession.updateMany({
    where: { linkId: input.link.id, purpose: input.purpose, revokedAt: null },
    data: { revokedAt: now },
  });
  await db.contractPublicSession.create({
    data: {
      tokenHash: hashAccessToken(token),
      contractId: input.link.contractId,
      versionId: input.link.versionId,
      linkId: input.link.id,
      purpose: input.purpose,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

export type ContractPublicSessionFailure =
  | "missing"
  | "not_found"
  | "wrong_purpose"
  | "revoked"
  | "expired"
  | "link_revoked"
  | "link_expired";

export type ContractPublicSessionResolution =
  | { ok: true; session: ContractPublicSessionRecord }
  | { ok: false; reason: ContractPublicSessionFailure; session: ContractPublicSessionRecord | null };

/**
 * Resolve the raw cookie value to a live session. A session is valid only when
 * it exists, matches the route's purpose, is unrevoked and unexpired, and its
 * parent link is still unrevoked and unexpired — link revocation therefore
 * kills outstanding sessions without a separate sweep.
 */
export async function resolveContractPublicSession(
  db: ContractPublicSessionDb,
  input: { purpose: ContractPublicLinkPurpose; token: string | null | undefined },
): Promise<ContractPublicSessionResolution> {
  if (!input.token) return { ok: false, reason: "missing", session: null };
  const session = await db.contractPublicSession.findUnique({
    where: { tokenHash: hashAccessToken(input.token) },
    include: { link: { select: { revokedAt: true, expiresAt: true } } },
  });
  if (!session) return { ok: false, reason: "not_found", session: null };
  if (session.purpose !== input.purpose) return { ok: false, reason: "wrong_purpose", session };
  if (session.revokedAt) return { ok: false, reason: "revoked", session };
  const now = new Date();
  if (session.expiresAt <= now) return { ok: false, reason: "expired", session };
  if (session.link?.revokedAt) return { ok: false, reason: "link_revoked", session };
  if (session.link && session.link.expiresAt <= now) return { ok: false, reason: "link_expired", session };
  await db.contractPublicSession.update({ where: { id: session.id }, data: { lastAccessedAt: now } }).catch(() => undefined);
  return { ok: true, session };
}

/** Read the session cookie off any Request-like object (NextRequest or plain Request). */
export function readContractPublicSessionToken(
  request: { headers: Headers },
  purpose: ContractPublicLinkPurpose,
): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  const name = contractPublicSessionCookieName(purpose);
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      const value = part.slice(eq + 1).trim();
      return value || null;
    }
  }
  return null;
}

/**
 * The cookie gets `Secure` when the request is HTTPS (directly or via the
 * forwarded proto the TLS terminator sets) and always in production, matching
 * the workspace-session convention.
 */
export function contractPublicSessionIsSecure(request: { url: string; headers: Headers }): boolean {
  try {
    if (new URL(request.url).protocol === "https:") return true;
  } catch {
    // Fall through to the header/env checks.
  }
  const forwarded = request.headers.get("x-forwarded-proto") || "";
  if (forwarded.split(",").map((value) => value.trim().toLowerCase()).includes("https")) return true;
  return process.env.NODE_ENV === "production";
}

export function setContractPublicSessionCookie(
  request: { url: string; headers: Headers },
  response: NextResponse,
  input: { purpose: ContractPublicLinkPurpose; token: string; expiresAt: Date },
): void {
  response.cookies.set({
    name: contractPublicSessionCookieName(input.purpose),
    value: input.token,
    httpOnly: true,
    sameSite: "lax",
    secure: contractPublicSessionIsSecure(request),
    path: CONTRACT_PUBLIC_SESSION_COOKIE_PATH,
    expires: input.expiresAt,
  });
}

export function clearContractPublicSessionCookie(
  response: NextResponse,
  purpose: ContractPublicLinkPurpose,
): void {
  response.cookies.set({
    name: contractPublicSessionCookieName(purpose),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: CONTRACT_PUBLIC_SESSION_COOKIE_PATH,
    expires: new Date(0),
  });
}

/** Human-facing message for a failed session lookup. Never echoes the failure code. */
export function contractPublicSessionMessage(kind: "acceptance" | "review" | "artifact"): string {
  if (kind === "review") return "This review session is no longer valid. Open the original review link again.";
  if (kind === "artifact") return "This download session is no longer valid. Open the original link again.";
  return "This acceptance session is no longer valid. Open the original acceptance link again.";
}

/*
 * Link validation shared by the bearer-token compatibility routes and the
 * session-exchange handlers. The exact strings are part of the public audit
 * contract — `classifyContractPublicLinkFailure` maps them to outcomes — so
 * keep them in one place and change them deliberately.
 */
type PublicLinkCheck = {
  type: string;
  revokedAt: Date | null;
  expiresAt: Date;
  version?: unknown;
  signer?: unknown;
  contract: { status: string };
} | null;

export function contractAcceptanceLinkProblem(link: PublicLinkCheck): string | null {
  if (!link || !["sign", "void"].includes(link.type)) return "Acceptance link not found.";
  if (link.revokedAt) return "This acceptance link has been revoked.";
  if (link.expiresAt <= new Date()) return "This acceptance link has expired. Ask the sender to reissue it.";
  if (!link.version || !link.signer) return "This acceptance link is incomplete.";
  if (!["signing", "executed"].includes(link.contract.status)) return "This Agreement is not currently accepting recorded acceptance.";
  return null;
}

export function contractVoidLinkProblem(link: PublicLinkCheck): string | null {
  if (!link || !["sign", "void"].includes(link.type)) return "Acceptance link not found.";
  if (link.revokedAt) return "This acceptance link has been revoked.";
  if (link.expiresAt <= new Date()) return "This acceptance link has expired. Ask the sender to reissue it.";
  if (!link.signer) return "This acceptance link is incomplete.";
  if (link.contract.status !== "executed") return "This Agreement is not eligible for voiding through this link.";
  return null;
}

export function contractReviewLinkProblem(link: PublicLinkCheck): string | null {
  if (!link || link.type !== "review") return "Review link not found.";
  if (link.revokedAt) return "This review link has been revoked. Ask the sender for a new link.";
  if (link.expiresAt <= new Date()) return "This review link has expired. Ask the sender for a new link.";
  if (!link.version) return "This review link is missing its Agreement version.";
  if (link.contract.status === "void") return "This Agreement has been voided.";
  return null;
}

export function contractArtifactLinkProblem(link: PublicLinkCheck): string | null {
  if (!link || link.type !== "artifact") return "Accepted Agreement link not found or expired.";
  if (link.revokedAt) return "Accepted Agreement link has been revoked.";
  if (link.expiresAt <= new Date()) return "Accepted Agreement link has expired.";
  if (!link.version) return "Accepted Agreement link is incomplete.";
  if (link.contract.status !== "executed") return "Accepted Agreement record is not ready.";
  return null;
}

/** Outcome label used when logging session-backed access failures. */
export function contractPublicSessionLogOutcome(reason: ContractPublicSessionFailure): string {
  return `session_${reason}`;
}
