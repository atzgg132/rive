"use client";
import PageShell from "@/components/PageShell";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

const sidebarItems = ["getting started","core concepts","remit payments api","gig board","ai co-pilot","webhooks"];

const codeSnippet = `POST /api/waitlist
Content-Type: application/json

{
  "email": "you@example.com",
  "type":  "waitlist"
}

// 201 Created
{
  "success": true,
  "message": "successfully joined the waitlist."
}`;

export default function DocsPage() {
  return (
    <PageShell>
      <div className="max-w-7xl mx-auto px-8 py-16 flex gap-10 min-h-[80vh]">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col gap-1 w-52 shrink-0">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-3" style={font}>contents</p>
          {sidebarItems.map(item => (
            <div key={item} className="flex items-center justify-between px-3 py-2 rounded-lg">
              <span className="text-sm text-slate-400 font-medium" style={font}>{item}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 font-bold" style={font}>soon</span>
            </div>
          ))}
        </aside>

        {/* Main */}
        <main className="flex-1 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 mb-6" style={font}>docs</div>
          <h1 className="text-5xl font-bold text-[#0C1E36] tracking-tight mb-4" style={fontD}>documentation</h1>
          <p className="text-slate-500 text-lg mb-8 leading-relaxed" style={font}>documentation is coming soon. we are writing it in parallel with building the product.</p>

          {/* Code block */}
          <div className="bg-[#0C1E36] rounded-2xl overflow-hidden mb-10">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-white/40 text-xs ml-2 font-mono">rive. api — preview</span>
            </div>
            <pre className="p-5 text-sm font-mono text-emerald-300 leading-relaxed overflow-x-auto">{codeSnippet}</pre>
          </div>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-sm hover:from-blue-700 hover:to-sky-600 transition-all shadow-lg shadow-blue-600/15"
            style={fontD}
          >
            join waitlist for api access →
          </button>
        </main>
      </div>
    </PageShell>
  );
}
