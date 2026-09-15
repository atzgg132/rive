import { connection } from "next/server";
import { Check, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { MarketingButton } from "@/components/marketing/primitives";
import { ClosingCta, ReadingHero } from "@/components/marketing/shells";
import { migrationEngineAvailable } from "@/utils/migration/config";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Import business records into Rive", "Bring supported clients, projects, invoices, and expenses from CSV or XLSX with review before import.", "/migrate-to-rive");

const limits = ["Up to 10 files", "5 MB per file", "20 MB total", "20,000 rows total"];

const steps = [
  { icon: FileSpreadsheet, title: "Upload your files", body: "Use CSV or XLSX files containing supported business records." },
  { icon: ShieldCheck, title: "Review the result", body: "Check proposed records, relationships, warnings, and excluded rows." },
  { icon: Check, title: "Approve the import", body: "Resolve the required review items before adding records to your workspace." },
] as const;

export default async function MigrateToRivePage() {
  await connection();
  const available = migrationEngineAvailable();
  return (
    <>
      <ReadingHero
        eyebrow="Import your data"
        title={available ? "Bring your records. Review before you import." : "Start a workspace while importing is being validated."}
        intro={available ? "Import clients, projects, invoices, and expenses from CSV or XLSX. Review the proposed records and relationships before approving the import." : "CSV and XLSX importing is not currently enabled. You can create an account and add a client and project manually."}
      />
      <section className="inst-section" aria-label="How it works">
        <div className="inst-container">
          <div className="inst-dept"><span className="inst-mono">How it works</span><span className="inst-mono">Three steps</span></div>
          <div className="inst-entry">
            <h2 className="inst-display inst-display--sub inst-entry__title">Nothing is added before you review it.</h2>
            <ol className="inst-admit__list" style={{ marginTop: 0 }}>
              {steps.map((step, index) => (
                <li key={step.title}>
                  <span className="inst-mono">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <p style={{ fontWeight: 660, color: "var(--inst-ink)" }}>{step.title}</p>
                    <p style={{ color: "var(--inst-ink-soft)", fontSize: "0.92rem", marginTop: "0.25rem" }}>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div style={{ marginTop: "2rem" }}>
            <MarketingButton href={available ? "/register?goal=migrate&next=%2Fmigrate" : "/register"}>{available ? "Start with existing records" : "Start free"}</MarketingButton>
          </div>
        </div>
      </section>
      <section className="inst-section" aria-label="Limits and boundaries">
        <div className="inst-container">
          <div className="inst-dept"><span className="inst-mono">Current limits</span><span className="inst-mono">A defined first pass</span></div>
          <div className="inst-entry">
            <h2 className="inst-display inst-display--sub inst-entry__title">A defined first pass.</h2>
            <div className="inst-entry__body">
              <div className="inst-register">
                {limits.map((limit) => (
                  <div key={limit} className="inst-register__row">
                    <span className="inst-mono">Limit</span>
                    <span className="inst-register__name">{limit}</span>
                    <span className="inst-register__detail" />
                  </div>
                ))}
              </div>
              <div className="inst-panel" style={{ marginTop: "1.75rem" }}>
                <span className="inst-mono inst-panel__label">Boundaries stated up front</span>
                <p className="inst-panel__body" style={{ marginBottom: 0 }}>
                  Importing is not a direct integration with another business tool. Vendor-specific
                  compatibility is not guaranteed. Imported records remain after commit — retrying an
                  import is not the same as undoing it. Sign in before uploading business files.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <ClosingCta
        headline={available ? "Bring the work you already have." : "Start with one client today."}
        href={available ? "/register?goal=migrate&next=%2Fmigrate" : "/register"}
        label={available ? "Start importing" : "Start free"}
      />
    </>
  );
}
