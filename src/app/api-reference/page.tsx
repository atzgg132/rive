"use client";
import PageShell from "@/components/PageShell";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

const endpoints = [
  { method: "GET",  path: "/v1/projects",       desc: "list all projects for authenticated user" },
  { method: "POST", path: "/v1/invoices",        desc: "create a new invoice for a client" },
  { method: "GET",  path: "/v1/gigs",            desc: "browse the public gig board" },
  { method: "POST", path: "/v1/remit/transfer",  desc: "initiate an international payment transfer" },
  { method: "GET",  path: "/v1/clients",         desc: "list all clients" },
  { method: "POST", path: "/v1/ai/suggest",      desc: "get ai co-pilot suggestions for a task" },
];

const methodColor: Record<string, string> = {
  GET:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  POST: "bg-blue-50 text-blue-700 border border-blue-200",
};

export default function APIRefPage() {
  return (
    <PageShell>
      <section className="relative py-24 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[400px] h-[250px] bg-blue-100/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 mb-5" style={font}>api reference</div>
          <h1 className="text-5xl font-bold text-[#0C1E36] tracking-tight mb-3" style={fontD}>api reference</h1>
          <p className="text-slate-500 text-lg mb-4 leading-relaxed" style={font}>rive. provides a RESTful api for all platform features. full documentation coming soon.</p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-xs font-bold mb-12" style={font}>
            🔒 api access requires an invitation
          </div>

          {/* Endpoints */}
          <div className="flex flex-col gap-3 mb-12">
            {endpoints.map(ep => (
              <div key={ep.path} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex items-start gap-4">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 mt-0.5 ${methodColor[ep.method]}`} style={font}>{ep.method}</span>
                <div>
                  <code className="text-sm font-mono text-[#0C1E36] font-semibold">{ep.path}</code>
                  <p className="text-slate-400 text-xs mt-0.5" style={font}>{ep.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-sm hover:from-blue-700 hover:to-sky-600 transition-all shadow-lg shadow-blue-600/15"
            style={fontD}
          >
            join waitlist for api access →
          </button>
        </div>
      </section>
    </PageShell>
  );
}
