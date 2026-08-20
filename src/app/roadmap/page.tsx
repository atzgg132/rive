import Link from "next/link";
import { Check, Clock3, MessageSquareText } from "lucide-react";
import PageShell from "@/components/PageShell";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

const phases = [
  {
    label: "Available now",
    status: "shipped",
    description: "The open-beta workspace running today.",
    items: [
      "Clients, projects, milestones, invoices, and expenses",
      "Agreements with review, recorded acceptance, and invoice triggers",
      "Connected dashboard and business insights",
      "Apple Calendar feed",
      "CSV/XLSX and Zoho Books import through the Migration Engine, with preview, matching, and rollback",
      "Public portfolio studio, mixed media, inquiries, and analytics",
      "Open signup with email verification, free during open beta",
    ],
  },
  {
    label: "Next",
    status: "active",
    description: "Make onboarding, connectors, and invoicing dependable with real customer data.",
    items: [
      "Google Calendar, once Google approves the integration",
      "More reliable Zoho Books import",
      "Clearer onboarding and migration",
      "Invoice email delivery you can trust",
    ],
  },
  {
    label: "Later",
    status: "planned",
    description: "Sequenced by evidence from open-beta users.",
    items: [
      "QuickBooks Online and Xero connectors",
      "FreshBooks and additional migration sources",
      "Payments and opportunity workflows",
      "Teams and agency workspaces",
      "Mobile applications and public API access",
    ],
  },
] as const;

const statusStyles = {
  shipped: {
    card: "border-emerald-200 dark:border-emerald-900/70",
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    icon: "text-emerald-600 dark:text-emerald-400",
    label: "Shipped",
  },
  active: {
    card: "border-blue-200 shadow-lg dark:border-blue-800/80 dark:shadow-none",
    badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    icon: "text-blue-600 dark:text-blue-400",
    label: "In progress",
  },
  planned: {
    card: "border-slate-100 dark:border-slate-800",
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    icon: "text-slate-400",
    label: "Planned",
  },
} as const;

export default function RoadmapPage() {
  return (
    <PageShell>
      <section className="relative overflow-hidden py-24">
        <div className="pointer-events-none absolute left-1/3 top-0 h-[300px] w-[500px] rounded-full bg-blue-100/15 blur-[110px]" />
        <div className="relative mx-auto max-w-6xl px-8">
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/50 px-3.5 py-1.5 text-xs font-semibold text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-400"
            style={font}
          >
            Product roadmap
          </div>
          <h1
            className="mb-4 text-5xl font-bold tracking-tight text-foreground dark:text-white sm:text-6xl"
            style={fontD}
          >
            Open beta is live. Next we make it dependable.
          </h1>
          <p
            className="mb-5 max-w-2xl text-lg leading-relaxed text-slate-500 dark:text-slate-400"
            style={font}
          >
            Rive is open to everyone for free. The core workspace is live; our immediate
            focus is making onboarding, migration, and calendar connections
            dependable with real customer data.
          </p>
          <p className="mb-16 max-w-2xl text-sm text-slate-400 dark:text-slate-500" style={font}>
            Priorities may change as open-beta feedback arrives. We mark work
            as shipped only when it is available to people using the product.
          </p>

          <div className="mb-16 grid gap-6 md:grid-cols-3">
            {phases.map((phase) => {
              const styles = statusStyles[phase.status];
              return (
                <article
                  key={phase.label}
                  className={`flex flex-col gap-5 rounded-2xl border bg-white p-7 shadow-sm transition-colors dark:bg-slate-900 ${styles.card}`}
                >
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="text-2xl font-bold text-foreground dark:text-white" style={fontD}>
                        {phase.label}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${styles.badge}`}
                        style={font}
                      >
                        {styles.label}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400" style={font}>
                      {phase.description}
                    </p>
                  </div>
                  <ul className="flex flex-col gap-3">
                    {phase.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm" style={font}>
                        {phase.status === "active" ? (
                          <Clock3 className={`mt-0.5 h-4 w-4 shrink-0 ${styles.icon}`} />
                        ) : (
                          <Check className={`mt-0.5 h-4 w-4 shrink-0 ${styles.icon}`} />
                        )}
                        <span className="text-slate-600 dark:text-slate-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>

          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <MessageSquareText className="mx-auto mb-4 h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h2 className="mb-2 text-xl font-bold text-foreground dark:text-white" style={fontD}>
              Help shape what comes next
            </h2>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400" style={font}>
              Tell us about the workflow you need or the product you are migrating from.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
              style={font}
            >
              Share feedback
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
