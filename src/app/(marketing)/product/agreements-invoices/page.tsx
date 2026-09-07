import { EditorialProductPage } from "@/components/marketing/EditorialProductPage";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Agreements and invoices for client work | Rive", "Prepare agreements, record acceptance, and manage invoices alongside the client work they belong to.", "/product/agreements-invoices");

export default function AgreementsInvoicesPage() {
  return <EditorialProductPage kind="agreements" />;
}
