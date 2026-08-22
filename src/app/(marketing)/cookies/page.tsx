import { ProseShell } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive cookie policy", "How Rive uses cookies and local storage.", "/cookies");

const fontD = { fontFamily: "var(--font-display)" };
const font  = { fontFamily: "var(--font-body)" };

const toc = [
  { id: "what",    label: "1. What are cookies" },
  { id: "types",   label: "2. Cookies we use" },
  { id: "manage",  label: "3. Managing cookies" },
  { id: "third",   label: "4. Third-party cookies" },
  { id: "changes", label: "5. Changes to this policy" },
  { id: "contact", label: "6. Contact us" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24 mb-10">
      <h2 className="mb-3 border-b border-white/[0.08] pb-2 text-xl font-bold text-white" style={fontD}>{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-300" style={font}>{children}</div>
    </div>
  );
}

const cookieTypes = [
  { name: "Essential",    desc: "Required for the website to function. These cannot be disabled. They include session management and security tokens.", label: "Always active" },
  { name: "Analytics",    desc: "Used to understand how visitors interact with the site. We use Vercel Analytics, which is privacy-first and uses no persistent cookies.", label: "No cookies set" },
  { name: "Preferences",  desc: "Remember your settings and preferences across visits, such as language and theme. These are optional and minimal.", label: "Optional" },
];

export default function CookiesPage() {
  return (
    <ProseShell eyebrow="LEGAL" title="Cookie Policy" updated="Last updated · July 13, 2026">
        <div className="flex flex-col gap-8 md:flex-row md:gap-12">
          {/* Sticky TOC */}
          <aside className="hidden md:block w-56 shrink-0">
            <div className="sticky top-24 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400" style={font}>On this page</p>
              <nav className="flex flex-col gap-2">
                {toc.map(item => (
                  <a key={item.id} href={`#${item.id}`}
                    className="py-0.5 text-sm font-medium text-slate-400 transition-colors hover:text-blue-300"
                    style={font}>{item.label}</a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="min-w-0 max-w-2xl flex-1">
            <div>

              <Section id="what" title="1. What are cookies">
                <p>Cookies are small text files stored on your device by a website. They are widely used to make websites work correctly, remember your preferences, and provide anonymised usage data to site owners.</p>
                <p>rive. uses a minimal number of cookies and is committed to being transparent about exactly what we set and why.</p>
              </Section>

              <Section id="types" title="2. Cookies we use">
                <div className="flex flex-col gap-4">
                  {cookieTypes.map(ct => (
                    <div key={ct.name} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-foreground dark:text-white text-sm capitalize" style={fontD}>{ct.name}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 font-bold" style={font}>{ct.label}</span>
                      </div>
                      <p className="text-sm text-slate-400" style={font}>{ct.desc}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section id="manage" title="3. Managing cookies">
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

              <Section id="third" title="4. Third-party cookies">
                <p>We use <strong>Vercel Analytics</strong> for privacy-friendly, aggregated website statistics. Vercel Analytics is designed to be cookieless and does not track individual users across sessions or websites.</p>
                <p>We do not use advertising networks, retargeting platforms, or social-media tracking pixels.</p>
              </Section>

              <Section id="changes" title="5. Changes to this policy">
                <p>We may update this Cookie Policy to reflect changes in the technologies we use or applicable regulations. The &quot;last updated&quot; date at the top indicates the most recent revision. For material changes, we will notify account holders through the Service or by email.</p>
              </Section>

              <Section id="contact" title="6. Contact us">
                <p>If you have questions about our use of cookies:</p>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mt-2">
                  <p><strong>Email:</strong> <a href="mailto:hello@rive.work" className="text-blue-600 dark:text-blue-400 hover:underline">hello@rive.work</a></p>
                  <p className="mt-1"><strong>Response time:</strong> Within 72 hours</p>
                </div>
              </Section>

            </div>
          </div>
      </div>
    </ProseShell>
  );
}
