import PageShell from "@/components/PageShell";

const fontD = { fontFamily: "var(--font-display)" };
const font  = { fontFamily: "var(--font-body)" };

const toc = [
  { id: "what",    label: "1. what are cookies" },
  { id: "types",   label: "2. cookies we use" },
  { id: "manage",  label: "3. managing cookies" },
  { id: "third",   label: "4. third-party cookies" },
  { id: "changes", label: "5. changes to this policy" },
  { id: "contact", label: "6. contact us" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24 mb-10">
      <h2 className="text-xl font-bold text-[#0C1E36] dark:text-white mb-3 pb-2 border-b border-slate-100 dark:border-slate-800" style={fontD}>{title}</h2>
      <div className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed space-y-3" style={font}>{children}</div>
    </div>
  );
}

const cookieTypes = [
  { name: "essential",    desc: "required for the website to function. these cannot be disabled. they include session management and security tokens.", label: "always active" },
  { name: "analytics",    desc: "used to understand how visitors interact with the site. we use Vercel Analytics, which is privacy-first and uses no persistent cookies.", label: "no cookies set" },
  { name: "preferences",  desc: "remember your settings and preferences across visits (e.g. language, theme). these are optional and minimal.", label: "optional" },
];

export default function CookiesPage() {
  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-8 py-16">
        <div className="mb-12">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest" style={font}>legal</span>
          <h1 className="text-5xl font-bold text-[#0C1E36] dark:text-white tracking-tight mt-2 mb-3" style={fontD}>cookie policy</h1>
          <p className="text-slate-400 dark:text-slate-500 text-sm" style={font}>last updated: July 13, 2026</p>
        </div>

        <div className="flex gap-12">
          {/* Sticky TOC */}
          <aside className="hidden md:block w-56 shrink-0">
            <div className="sticky top-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none p-5 transition-colors">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4" style={font}>on this page</p>
              <nav className="flex flex-col gap-2">
                {toc.map(item => (
                  <a key={item.id} href={`#${item.id}`}
                    className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium py-0.5"
                    style={font}>{item.label}</a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <main className="flex-1 max-w-2xl">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none p-8 md:p-10 transition-colors">

              <Section id="what" title="1. what are cookies">
                <p>Cookies are small text files stored on your device by a website. They are widely used to make websites work correctly, remember your preferences, and provide anonymised usage data to site owners.</p>
                <p>rive. uses a minimal number of cookies and is committed to being transparent about exactly what we set and why.</p>
              </Section>

              <Section id="types" title="2. cookies we use">
                <div className="flex flex-col gap-4">
                  {cookieTypes.map(ct => (
                    <div key={ct.name} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-[#0C1E36] dark:text-white text-sm capitalize" style={fontD}>{ct.name}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 font-bold" style={font}>{ct.label}</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-sm" style={font}>{ct.desc}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section id="manage" title="3. managing cookies">
                <p>You can control and manage cookies through your browser settings. Most browsers allow you to:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>View cookies that have been set</li>
                  <li>Delete individual cookies or all cookies</li>
                  <li>Block cookies from specific websites</li>
                  <li>Block all cookies from being set</li>
                </ul>
                <p>Please note that disabling essential cookies may affect the functionality of the rive. website. Analytics and preference cookies can be blocked without any loss of core functionality.</p>
                <p>Browser-specific instructions: <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Chrome</a>, <a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Firefox</a>, <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Safari</a>.</p>
              </Section>

              <Section id="third" title="4. third-party cookies">
                <p>We use <strong>Vercel Analytics</strong> for privacy-friendly, aggregated website statistics. Vercel Analytics is designed to be cookieless and does not track individual users across sessions or websites.</p>
                <p>We do not use any advertising networks, retargeting platforms, or social media tracking pixels.</p>
              </Section>

              <Section id="changes" title="5. changes to this policy">
                <p>We may update this Cookie Policy to reflect changes in the technologies we use or applicable regulations. The &quot;last updated&quot; date at the top indicates the most recent revision. For material changes, we will notify waitlist members by email.</p>
              </Section>

              <Section id="contact" title="6. contact us">
                <p>If you have questions about our use of cookies:</p>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mt-2">
                  <p><strong>email:</strong> <a href="mailto:privacy@rive.app" className="text-blue-600 dark:text-blue-400 hover:underline">privacy@rive.app</a></p>
                  <p className="mt-1"><strong>response time:</strong> within 72 hours</p>
                </div>
              </Section>

            </div>
          </main>
        </div>
      </div>
    </PageShell>
  );
}
