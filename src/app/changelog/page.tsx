import PageShell from "@/components/PageShell";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

const timeline = [
  { date: "August 2026", title: "Open beta", desc: "Rive is open to everyone. Create a free account, verify your email, and use the workspace. No invitation required. The product stays free while we learn from real workflows.", badge: "Latest" },
  { date: "August 2026", title: "Agreements, review, and recorded acceptance", desc: "Draft a contract from the client and project context you already have, share a review link, collect recorded acceptance, and turn agreed payment terms into deliberate invoice triggers. This is not a regulated e-signature product.", badge: null },
  { date: "August 2026", title: "Migration Engine", desc: "Preview CSV or XLSX exports, and Zoho Books when connected. Match relationships, commit with rollback, and start from real records instead of an empty workspace.", badge: null },
  { date: "August 2026", title: "Apple Calendar feed", desc: "Subscribe to a private Apple Calendar feed of Rive deadlines and scheduled work.", badge: null },
  { date: "August 2026", title: "Invoices you can stand behind", desc: "Void with confirmation, share a public invoice link, record payment history, and show an outstanding balance that matches what the client sees.", badge: null },
  { date: "August 2026", title: "Richer portfolios", desc: "Mixed media, multi-practice sites, inquiry capture, and analytics for views, devices, and referrers, so published work can actually win the next conversation.", badge: null },
  { date: "July 2026", title: "Connected onboarding and workspace migration", desc: "New accounts can preview and import operational CSV data, build a connected first workflow, and receive an automatically prefilled portfolio instead of opening an empty workspace.", badge: null },
  { date: "July 2026", title: "Portfolio studio shipped", desc: "Create one polished, public portfolio from the work already in your workspace. Choose from six starting templates, edit your identity and case studies, customize the visual system, and publish a shareable link.", badge: null },
  { date: "July 2026", title: "Portfolio analytics shipped", desc: "Understand how your public work is performing with total views, unique visitors, daily reach, peak days, referral sources, and device breakdowns.", badge: null },
  { date: "June 2026", title: "Case studies and media uploads", desc: "Portfolio projects now support challenge, approach, outcome, tools, deliverables, galleries, direct image uploads, and HTTPS image URLs, with dedicated public case-study pages.", badge: null },
  { date: "June 2026", title: "Connected service workflows", desc: "The core workspace now brings together dashboard reporting, clients, projects, milestones, revenue, invoices, and expenses so the business behind the work stays connected.", badge: null },
  { date: "May 2026", title: "Production-ready portfolio foundation", desc: "Added one-portfolio-per-user enforcement, server-side content and URL validation, safe media limits, draft and published states, SEO controls, responsive previews, and light or dark presentation modes.", badge: null },
];

export default function ChangelogPage() {
  return (
    <PageShell>
      <section className="relative py-24 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[400px] h-[300px] bg-blue-100/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 mb-5" style={font}>Product history</div>
          <h1 className="text-6xl font-bold text-foreground dark:text-white tracking-tight mb-4" style={fontD}>Changelog</h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg mb-16 leading-relaxed" style={font}>A transparent log of what we&apos;ve shipped, in reverse chronological order.</p>

          <div className="relative">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-blue-200 dark:from-blue-800 via-slate-200 dark:via-slate-800 to-transparent" />
            <div className="flex flex-col gap-10">
              {timeline.map((item, i) => (
                <div key={i} className="flex gap-6">
                  <div className="relative flex-shrink-0 mt-1">
                    <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center ${i === 0 ? "border-blue-500 bg-blue-500" : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"}`}>
                      {i === 0 && <span className="w-2 h-2 rounded-full bg-white dark:bg-slate-900" />}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none p-6 flex-1 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest" style={font}>{item.date}</span>
                      {item.badge && <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold uppercase">{item.badge}</span>}
                    </div>
                    <h3 className="text-lg font-bold text-foreground dark:text-white mb-2" style={fontD}>{item.title}</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed" style={font}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
