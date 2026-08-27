import type { Metadata } from "next";
import { MarketingHome } from "@/components/marketing/MarketingHome";

export const metadata: Metadata = {
  title: "Create your workspace — Rive",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return <MarketingHome />;
}
