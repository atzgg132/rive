import { redirect } from "next/navigation";

// Preserve old campaign links and bookmarks while making the product's new
// open-signup state explicit. Referral query parameters are retained by the
// browser when callers follow the redirect.
export default function LegacyWaitlistPage() {
  redirect("/register");
}
