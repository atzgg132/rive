import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create your free account — Rive", description: "Create a Rive account free during open beta. No credit card required.", robots: { index: false, follow: false } };

export default function RegisterPage() {
  return <div className="edition-auth-route" aria-hidden="true" />;
}
