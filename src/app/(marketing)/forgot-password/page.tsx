import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reset your password — Rive", description: "Request a secure password reset link for your Rive account.", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return <div className="edition-auth-route" aria-hidden="true" />;
}
