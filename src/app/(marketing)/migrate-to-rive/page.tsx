import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, CheckCircle2, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { migrationEngineAvailable } from "@/utils/migration/config";

export const metadata: Metadata = {
  title: "Migrate to Rive — Preview your CSV and XLSX import",
  description: "Bring clients, projects, invoices, and expenses into Rive from CSV or XLSX with a review before commit.",
};

export default async function MigrateToRivePage() {
  // This flag is operator-managed at container start, not a build argument.
  // Evaluate it for each request so the acquisition promise follows the live
  // kill switch instead of being frozen into the image during prerendering.
  await connection();
  const available = migrationEngineAvailable();
  const cta = available ? "/register?goal=migrate&next=%2Fmigrate" : "/register";

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-20 sm:px-8 sm:pt-28">
      <section className="mx-auto max-w-4xl text-center">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary">Migrate to Rive</p>
        <h1 className="mt-5 text-balance text-4xl font-black tracking-[-0.045em] text-foreground sm:text-6xl">
          {available ? "Bring your existing business into Rive." : "Prepare your business data for Rive."}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          {available
            ? "Upload CSV or XLSX exports for clients, projects, invoices, and expenses. Review uncertain matches before anything is added, then retry safely without creating duplicates."
            : "CSV and XLSX import is being production-validated. Create a workspace now; we will only present the full relationship-review flow when it is ready."}
        </p>
        <Link href={cta} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/15">
          {available ? "Start with my existing data" : "Create a Rive workspace"}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-3" aria-label="Migration guarantees">
        <Promise icon={<FileSpreadsheet className="h-5 w-5" />} title="Four record types">
          Generic CSV and XLSX files for clients, projects, invoices, and expenses. Up to 10 files, 5 MB each, 20 MB and 20,000 rows total.
        </Promise>
        <Promise icon={<ShieldCheck className="h-5 w-5" />} title="Preview before commit">
          See raw-to-normalized values, provenance, proposed creates and links, warnings, and every row that will be excluded.
        </Promise>
        <Promise icon={<CheckCircle2 className="h-5 w-5" />} title="No silent overwrite">
          Existing records are never overwritten. A retry resumes the same approved plan and skips operations already applied.
        </Promise>
      </section>

      <section className="mt-12 rounded-3xl border border-[var(--stroke-hairline)] bg-[var(--surface-raised)] p-6 sm:p-9">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">What the review asks you</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
              <li>Confirm close client and project relationships.</li>
              <li>Choose link, keep separate, merge, or skip.</li>
              <li>Explicitly resolve or skip every uncertain and invalid row.</li>
              <li>Approve the final create, link, and skip totals.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">Boundaries we state up front</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
              <li>No named-vendor fidelity promise or vendor-specific adapter in V1.</li>
              <li>Imported records remain after commit; recovery retries and resumes the same approved plan.</li>
              <li>Original private uploads expire after 30 days; parsed provenance stays in the migration audit record.</li>
              <li>Authentication is required before a file leaves your device.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function Promise({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-[var(--stroke-hairline)] bg-[var(--surface-raised)] p-5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">{icon}</span>
      <h2 className="mt-4 text-base font-bold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
    </article>
  );
}
