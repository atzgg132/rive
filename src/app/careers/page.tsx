"use client";
import PageShell from "@/components/PageShell";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

const roles = [
  { title: "senior full-stack engineer", type: "remote · full-time · equity + salary", desc: "build the core platform. own critical infrastructure. work with node, next.js, postgres, and ai." },
  { title: "product designer", type: "remote · full-time · equity + salary", desc: "define the look and feel of rive. from the ground up. own design systems, user flows, and brand." },
  { title: "growth & community lead", type: "remote · full-time · equity + salary", desc: "grow the waitlist, build the community, and shape how the world discovers rive." },
];

const values = [
  { emoji: "🚀", title: "high ownership", desc: "you own what you build. end to end." },
  { emoji: "🌍", title: "fully remote", desc: "work from anywhere. we are async-first." },
  { emoji: "💡", title: "builders first", desc: "everyone ships. design, code, ideas — all welcome." },
  { emoji: "🤝", title: "honest equity", desc: "real equity. real upside. we grow together." },
];

export default function CareersPage() {
  return (
    <PageShell>
      <section className="relative py-24 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[300px] bg-blue-100/15 rounded-full blur-[110px] pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-8">

          {/* Header */}
          <div className="mb-16 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 mb-5" style={font}>we&apos;re hiring</div>
            <h1 className="text-6xl font-bold text-[#0C1E36] tracking-tight mb-4 leading-tight" style={fontD}>build the future of work with us.</h1>
            <p className="text-slate-500 text-lg leading-relaxed" style={font}>small team, high ownership. everyone ships. everyone matters.</p>
          </div>

          {/* Values */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            {values.map(v => (
              <div key={v.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <span className="text-2xl mb-3 block">{v.emoji}</span>
                <h4 className="font-bold text-[#0C1E36] text-sm mb-1" style={fontD}>{v.title}</h4>
                <p className="text-slate-500 text-xs leading-relaxed" style={font}>{v.desc}</p>
              </div>
            ))}
          </div>

          {/* Open roles */}
          <h2 className="text-2xl font-bold text-[#0C1E36] mb-6" style={fontD}>open roles</h2>
          <div className="flex flex-col gap-4 mb-14">
            {roles.map(role => (
              <div key={role.title} className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:shadow-blue-100/30 hover:border-blue-200 transition-all duration-300 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-[#0C1E36] mb-1 group-hover:text-blue-700 transition-colors" style={fontD}>{role.title}</h3>
                  <p className="text-xs text-slate-400 font-semibold mb-2 uppercase tracking-wide" style={font}>{role.type}</p>
                  <p className="text-slate-500 text-sm leading-relaxed max-w-lg" style={font}>{role.desc}</p>
                </div>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
                  className="shrink-0 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-sm hover:from-blue-700 hover:to-sky-600 transition-all shadow-lg shadow-blue-600/15 whitespace-nowrap"
                  style={fontD}
                >
                  apply
                </button>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
            <h3 className="text-xl font-bold text-[#0C1E36] mb-2" style={fontD}>don&apos;t see your role?</h3>
            <p className="text-slate-500 text-sm mb-1" style={font}>we&apos;re always open to exceptional people. reach out directly.</p>
            <a href="mailto:careers@rive.app" className="text-blue-600 font-semibold text-sm hover:text-blue-700 transition-colors" style={fontD}>careers@rive.app →</a>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
