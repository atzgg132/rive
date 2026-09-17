import type { Metadata } from "next";
import ContractReviewPublicPage from "@/components/contracts/ContractReviewPublicPage";

export const metadata: Metadata = {
  title: "Agreement review — rive.",
  robots: { index: false, follow: false },
};

// Clean review page. The bearer link was already exchanged for the HttpOnly
// session cookie on the way here; the client only calls the reserved "session"
// API paths.
export default function ContractReviewPage() {
  return <ContractReviewPublicPage />;
}
