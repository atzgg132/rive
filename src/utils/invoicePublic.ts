import crypto from "crypto";

export function createInvoicePublicToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInvoicePublicToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function invoicePublicUrl(token: string): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/invoice/${encodeURIComponent(token)}`;
}
