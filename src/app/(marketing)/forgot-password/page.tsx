import type { Metadata } from "next";
import { MarketingHome } from "@/components/marketing/MarketingHome";

export const metadata: Metadata = {
  title: "Reset your password — Rive",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <MarketingHome />;
}
