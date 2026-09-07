import { EditorialProductPage } from "@/components/marketing/EditorialProductPage";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Client and project management for independent businesses | Rive", "Manage client details, projects, tasks, milestones, and deadlines in Rive.", "/product/clients-projects");

export default function ClientsProjectsPage() {
  return <EditorialProductPage kind="clients" />;
}
