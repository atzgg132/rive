"use client";

import { Button } from "@/components/ui";
import PageShell from "@/components/PageShell";
import { useRouter } from "next/navigation";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

const sidebarItems = [
  { id: "getting-started", label: "Getting started" },
  { id: "core-concepts", label: "Core concepts" },
  { id: "workflow", label: "Workflow" },
  { id: "imports", label: "Imports and calendars" },
  { id: "api", label: "Application API" },
];

const codeSnippet = `POST /api/auth/register
Content-Type: application/json

{
  "email": "you@example.com",
  "password": "use-a-strong-password",
  "name": "Your name"
}

// 201 Created
{
  "success": true,
  "requiresEmailVerification": true
}`;

export default function DocsPage() {
  const router = useRouter();
  return (
    <PageShell>
      <div className="max-w-7xl mx-auto px-8 py-16 flex gap-10 min-h-[80vh]">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col gap-1 w-52 shrink-0">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 px-3" style={font}>Contents</p>
          {sidebarItems.map(item => (
            <a key={item.id} href={`#${item.id}`} className="px-3 py-2 rounded-lg text-sm text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" style={font}>{item.label}</a>
          ))}
        </aside>

        {/* Main */}
        <main className="flex-1 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/40 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-6" style={font}>Docs</div>
          <h1 className="text-5xl font-bold text-foreground dark:text-white tracking-tight mb-4" style={fontD}>Documentation</h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg mb-8 leading-relaxed" style={font}>Create a free account, verify your email, and use the connected workspace. The essentials for working with rive. are below.</p>

          {/* Code block */}
          <div className="bg-[#0C1E36] rounded-2xl overflow-hidden mb-10">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-white/40 text-xs ml-2 font-mono">Create an account</span>
            </div>
            <pre className="p-5 text-sm font-mono text-emerald-300 leading-relaxed overflow-x-auto">{codeSnippet}</pre>
          </div>

          <div className="flex flex-col gap-8 text-slate-600 dark:text-slate-300" style={font}>
            <section id="getting-started">
              <h2 className="text-2xl font-bold text-foreground dark:text-white mb-2" style={fontD}>Getting started</h2>
              <p>Create a free account, verify your email, then open the workspace overview. Every client, project, Agreement, invoice, expense, and portfolio record is scoped to your account.</p>
            </section>
            <section id="core-concepts">
              <h2 className="text-2xl font-bold text-foreground dark:text-white mb-2" style={fontD}>Core concepts</h2>
              <p>Clients own the relationship. Projects track delivery. Agreements capture scope, review, and recorded acceptance. Invoices track money owed. Expenses track costs. The calendar and dashboard reuse those same records so dates, collections, and next actions stay connected.</p>
            </section>
            <section id="workflow">
              <h2 className="text-2xl font-bold text-foreground dark:text-white mb-2" style={fontD}>Workflow</h2>
              <p>Start with a client, create a project, add milestones, optionally send an Agreement for review, issue invoices, and record expenses. Paid invoices and expenses roll into net earnings. Completed work can become a public portfolio with inquiries and analytics.</p>
            </section>
            <section id="imports">
              <h2 className="text-2xl font-bold text-foreground dark:text-white mb-2" style={fontD}>Imports and calendars</h2>
              <p>Bring clients, projects, invoices, and expenses in from CSV or XLSX. The Migration Engine previews matches and can roll a commit back. Subscribe to a private Apple Calendar feed of Rive deadlines. Zoho Books import is available when connected.</p>
            </section>
            <section id="api">
              <h2 className="text-2xl font-bold text-foreground dark:text-white mb-2" style={fontD}>Application API</h2>
              <p>There is no public API or webhook product in open beta. The routes under <code className="text-blue-600 dark:text-blue-400">/api</code> power the workspace itself and use the Rive session cookie. Public invoice links, public portfolio pages, and the rates preview are the deliberate unauthenticated surfaces. A public API remains on the later roadmap.</p>
            </section>
          </div>

          <Button
            onClick={() => router.push("/register")}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-sm hover:from-blue-700 hover:to-sky-600 transition-all shadow-lg shadow-blue-600/15"
            style={fontD}
          >
            Create a free account →
          </Button>
        </main>
      </div>
    </PageShell>
  );
}
