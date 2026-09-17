import type { Metadata } from "next";
import ContractSignPublicPage from "@/components/contracts/ContractSignPublicPage";

export const metadata: Metadata = {
  title: "Agreement acceptance — rive.",
  robots: { index: false, follow: false },
};

// Clean acceptance page. The bearer link was already exchanged for the
// HttpOnly session cookie on the way here; the client only calls the reserved
// "session" API paths.
export default function ContractSignPage() {
  return <ContractSignPublicPage />;
}
