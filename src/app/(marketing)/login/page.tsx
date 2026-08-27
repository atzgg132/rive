import type { Metadata } from "next";
import { MarketingHome } from "@/components/marketing/MarketingHome";

export const metadata: Metadata = {
  title: "Sign in — Rive",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <MarketingHome />;
}
