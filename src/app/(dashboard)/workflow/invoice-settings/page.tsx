import { redirect } from "next/navigation";

// Invoice settings moved into the Business & invoicing section of Settings.
// Keep this route alive as a redirect so old links and bookmarks still land
// somewhere useful.
export default function InvoiceSettingsRedirectPage() {
  redirect("/settings#invoicing");
}
