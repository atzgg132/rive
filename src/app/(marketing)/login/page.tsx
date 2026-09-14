import type { Metadata } from "next";

export const metadata: Metadata = { title: "Log in — Rive", description: "Log in to your Rive workspace.", robots: { index: false, follow: false } };

export default function LoginPage() {
  return <div className="inst-auth-route" aria-hidden="true" />;
}
