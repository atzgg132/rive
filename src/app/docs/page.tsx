"use client";
import PageShell from "@/components/PageShell";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

const sidebarItems = [
  { id: "getting-started", label: "getting started" },
  { id: "core-concepts", label: "core concepts" },
  { id: "api", label: "remit payments api" },
  { id: "workflow", label: "workflow" },
  { id: "webhooks", label: "webhooks" },
];

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
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 px-3" style={font}>contents</p>
          {sidebarItems.map(item => (
            <a key={item.id} href={`#${item.id}`} className="px-3 py-2 rounded-lg text-sm text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" style={font}>{item.label}</a>
          ))}
        </aside>

        {/* Main */}
        <main className="flex-1 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/40 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-6" style={font}>docs</div>
          <h1 className="text-5xl font-bold text-[#0C1E36] dark:text-white tracking-tight mb-4" style={fontD}>documentation</h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg mb-8 leading-relaxed" style={font}>the essentials for joining the waitlist, using the workspace, and integrating with rive. are below.</p>

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

          <div className="flex flex-col gap-8 text-slate-600 dark:text-slate-300" style={font}>
            <section id="getting-started">
              <h2 className="text-2xl font-bold text-[#0C1E36] dark:text-white mb-2" style={fontD}>getting started</h2>
              <p>create an account, then open the workspace overview to manage clients, projects, invoices, and expenses. every record is scoped to your account.</p>
            </section>
            <section id="core-concepts">
              <h2 className="text-2xl font-bold text-[#0C1E36] dark:text-white mb-2" style={fontD}>core concepts</h2>
              <p>clients own the relationship, projects track delivery, invoices track money owed, and expenses track costs. link records together to keep financial reporting accurate.</p>
            </section>
            <section id="api">
              <h2 className="text-2xl font-bold text-[#0C1E36] dark:text-white mb-2" style={fontD}>api access</h2>
              <p>the current application API is available under <code className="text-blue-600 dark:text-blue-400">/api</code>. authenticated workflow requests use the rive session cookie; public waitlist and rates endpoints do not require authentication.</p>
            </section>
            <section id="workflow">
              <h2 className="text-2xl font-bold text-[#0C1E36] dark:text-white mb-2" style={fontD}>workflow</h2>
              <p>start with a client, create a project, add milestones, issue invoices, and record expenses. the dashboard aggregates paid invoices and expenses into your net earnings.</p>
            </section>
            <section id="webhooks">
              <h2 className="text-2xl font-bold text-[#0C1E36] dark:text-white mb-2" style={fontD}>webhooks</h2>
              <p>webhook delivery is not enabled in the current release. use the waitlist to request integration access while the event contract is finalized.</p>
            </section>
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
