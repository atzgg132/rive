import PageShell from "@/components/PageShell";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

const timeline = [
  { date: "July 2026", title: "portfolio studio shipped", desc: "create one polished, public portfolio from the work already in your workspace. choose from six starting templates, edit your identity and case studies, customize the visual system, and publish a shareable link.", badge: "latest" },
  { date: "July 2026", title: "portfolio analytics shipped", desc: "understand how your public work is performing with total views, unique visitors, daily reach, peak days, referral sources, and device breakdowns.", badge: null },
  { date: "June 2026", title: "case studies and media uploads", desc: "portfolio projects now support challenge, approach, outcome, tools, deliverables, galleries, direct image uploads, and HTTPS image URLs — with dedicated public case-study pages.", badge: null },
  { date: "June 2026", title: "connected freelance workflows", desc: "the core workspace now brings together dashboard reporting, clients, projects, milestones, revenue, invoices, and expenses so the business behind the work stays connected.", badge: null },
  { date: "May 2026", title: "production-ready portfolio foundation", desc: "added one-portfolio-per-user enforcement, server-side content and URL validation, safe media limits, draft and published states, SEO controls, responsive previews, and light or dark presentation modes.", badge: null },
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
