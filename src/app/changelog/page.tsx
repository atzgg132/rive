import PageShell from "@/components/PageShell";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

const timeline = [
  { date: "July 2026",  title: "alpha waitlist launched", desc: "500+ early signups in the first 48 hours. the waitlist is open — join to secure your spot.", badge: "latest" },
  { date: "June 2026",  title: "remit payments engine prototype", desc: "our global payment layer prototype is complete, supporting 47 countries with near-instant settlement.", badge: null },
  { date: "May 2026",   title: "gig board v1 shipped internally", desc: "ai-powered job matching prototype delivered. internal team tests show a 3× improvement in match quality.", badge: null },
  { date: "April 2026", title: "design system finalized", desc: "outfit typeface, ice-blue palette, and full component library locked in. the rive. look is born.", badge: null },
  { date: "March 2026", title: "rive. incorporated", desc: "team of three begins building. mission: one platform for every freelancer's operating needs.", badge: null },
];

export default function ChangelogPage() {
  return (
    <PageShell>
      <section className="relative py-24 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[400px] h-[300px] bg-blue-100/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 mb-5" style={font}>product history</div>
          <h1 className="text-6xl font-bold text-[#0C1E36] tracking-tight mb-4" style={fontD}>changelog</h1>
          <p className="text-slate-500 text-lg mb-16 leading-relaxed" style={font}>a transparent log of what we've shipped, in reverse chronological order.</p>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-blue-200 via-slate-200 to-transparent" />
            <div className="flex flex-col gap-10">
              {timeline.map((item, i) => (
                <div key={i} className="flex gap-6">
                  <div className="relative flex-shrink-0 mt-1">
                    <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center ${i === 0 ? "border-blue-500 bg-blue-500" : "border-slate-300 bg-white"}`}>
                      {i === 0 && <span className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest" style={font}>{item.date}</span>
                      {item.badge && <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold uppercase">{item.badge}</span>}
                    </div>
                    <h3 className="text-lg font-bold text-[#0C1E36] mb-2" style={fontD}>{item.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed" style={font}>{item.desc}</p>
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
