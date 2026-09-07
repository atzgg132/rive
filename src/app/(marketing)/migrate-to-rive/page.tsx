import { connection } from "next/server";
import { Check, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { EditorialLabel, MarketingButton } from "@/components/marketing/primitives";
import { migrationEngineAvailable } from "@/utils/migration/config";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Import business records into Rive", "Bring supported clients, projects, invoices, and expenses from CSV or XLSX with review before import.", "/migrate-to-rive");

const limits = ["Up to 10 files", "5 MB per file", "20 MB total", "20,000 rows total"];

export default async function MigrateToRivePage() {
  await connection();
  const available = migrationEngineAvailable();
  return (
    <>
      <section className="edition-import-hero"><div className="edition-container"><EditorialLabel>Import your data</EditorialLabel><h1 className="edition-display">{available ? "Bring your records. Review before you import." : "Start a workspace while importing is being validated."}</h1><div><p>{available ? "Import clients, projects, invoices, and expenses from CSV or XLSX. Review the proposed records and relationships before approving the import." : "CSV and XLSX importing is not currently enabled. You can create an account and add a client and project manually."}</p><MarketingButton href={available ? "/register?goal=migrate&next=%2Fmigrate" : "/register"}>{available ? "Start with existing records" : "Start free"}</MarketingButton></div></div></section>
      <section className="edition-import-process"><div className="edition-container"><div><EditorialLabel inverse>How it works</EditorialLabel><h2 className="edition-display">Nothing is added before you review it.</h2></div><ol><li><span>01</span><FileSpreadsheet /><h3>Upload your files</h3><p>Use CSV or XLSX files containing supported business records.</p></li><li><span>02</span><ShieldCheck /><h3>Review the result</h3><p>Check proposed records, relationships, warnings, and excluded rows.</p></li><li><span>03</span><Check /><h3>Approve the import</h3><p>Resolve the required review items before adding records to your workspace.</p></li></ol></div></section>
      <section className="edition-import-limits"><div className="edition-container"><div><EditorialLabel>Current limits</EditorialLabel><h2 className="edition-display">A defined first pass.</h2></div><ul>{limits.map((limit) => <li key={limit}>{limit}</li>)}</ul><div className="edition-import-boundaries"><h3>Boundaries stated up front</h3><p>Importing is not a direct integration with another business tool. Vendor-specific compatibility is not guaranteed.</p><p>Imported records remain after commit. Retrying an import is not the same as undoing it.</p><p>Sign in before uploading business files.</p></div></div></section>
      <section className="edition-page-cta"><div className="edition-container"><h2 className="edition-display">{available ? "Bring the work you already have." : "Start with one client today."}</h2><div><MarketingButton href={available ? "/register?goal=migrate&next=%2Fmigrate" : "/register"}>{available ? "Start importing" : "Start free"}</MarketingButton></div></div></section>
    </>
  );
}
