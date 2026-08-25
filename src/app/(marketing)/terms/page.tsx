import { LegalToc, ProseShell } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive terms of service", "The terms that apply when you use Rive.", "/terms");

const fontD = { fontFamily: "var(--font-display)" };
const font  = { fontFamily: "var(--font-body)" };

const toc = [
  { id: "acceptance",  label: "1. Acceptance of terms" },
  { id: "service",     label: "2. Description of service" },
  { id: "access",      label: "3. Open beta access" },
  { id: "conduct",     label: "4. User conduct" },
  { id: "ip",          label: "5. Intellectual property" },
  { id: "disclaimer",  label: "6. Disclaimers and limitation of liability" },
  { id: "termination", label: "7. Termination" },
  { id: "law",         label: "8. Governing law" },
  { id: "changes",     label: "9. Changes to terms" },
  { id: "contact",     label: "10. Contact" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="mb-10 scroll-mt-28">
      <h2 className="mb-3 border-b border-[var(--stroke-hairline)] pb-2 text-xl font-bold text-foreground" style={fontD}>{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground" style={font}>{children}</div>
    </div>
  );
}

export default function TermsPage() {
  return (
    <ProseShell eyebrow="LEGAL" title="Terms of Service" updated="Last updated · July 13, 2026">
        <div className="flex flex-col gap-8 md:flex-row md:gap-12">
          <LegalToc items={toc} />
          <div className="min-w-0 max-w-2xl flex-1 overflow-x-clip">
            <div>

              <Section id="acceptance" title="1. Acceptance of terms">
                <p>By accessing the rive. website, creating an account, or using any part of the rive. platform (collectively, the &quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, please do not use the Service.</p>
              </Section>

              <Section id="service" title="2. Description of service">
                <p>Rive is an early-stage operating workspace for digital service providers and small service businesses. The platform includes tools for client management, project delivery, invoicing, expenses, calendar planning, and public portfolios.</p>
                <p>Features, functionality, and availability may change at any time while the product is in open beta. rive. makes no guarantees about uptime, feature completeness, or suitability for any particular purpose during this stage.</p>
              </Section>

              <Section id="access" title="3. Open beta access">
                <p>Rive is currently available to anyone who visits the site, creates an account, and verifies their email. The workspace is offered free during open beta.</p>
                <p>Open-beta access may be modified, suspended, or ended as we improve the product. We will make reasonable efforts to communicate material changes.</p>
              </Section>

              <Section id="conduct" title="4. User conduct">
                <p>By using the Service, you agree not to:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Spam, scrape, or abuse the platform or its APIs.</li>
                  <li>Attempt to gain unauthorised access to any part of the Service.</li>
                  <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
                  <li>Impersonate rive. or any member of the rive. team.</li>
                  <li>Reverse-engineer or decompile any portion of the platform.</li>
                </ul>
              </Section>

              <Section id="ip" title="5. Intellectual property">
                <p>All content, design, code, trademarks, and brand assets on the rive. platform are the exclusive property of rive. and its founders. Nothing in these Terms grants you any rights to use rive.&apos;s intellectual property without explicit written permission.</p>
                <p>Any feedback, suggestions, or ideas you submit to rive. may be used by us freely without any obligation or compensation to you.</p>
              </Section>

              <Section id="disclaimer" title="6. Disclaimers and limitation of liability">
                <p>The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied. During open beta, we make no warranties about reliability, accuracy, fitness for a particular purpose, or non-infringement.</p>
                <p>To the fullest extent permitted by law, rive. shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, even if we have been advised of the possibility of such damages.</p>
              </Section>

              <Section id="termination" title="7. Termination">
                <p>rive. reserves the right to suspend or terminate your access to the Service at any time, for any reason, without notice. During open beta in particular, access may be revoked as we iterate on the platform.</p>
                <p>Upon termination, provisions that by their nature should survive (including IP, disclaimers, and governing law) will remain in effect.</p>
              </Section>

              <Section id="law" title="8. Governing law">
                <p>These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions. Any disputes shall be subject to the exclusive jurisdiction of the courts of India.</p>
              </Section>

              <Section id="changes" title="9. Changes to terms">
                <p>We may revise these Terms at any time. Material changes will be communicated through the Service or by email. The &quot;last updated&quot; date at the top of this page reflects the most recent revision. Continued use of the Service after changes constitutes acceptance.</p>
              </Section>

              <Section id="contact" title="10. Contact">
                <p>For questions about these Terms:</p>
                <div className="mt-2 rounded-xl bg-[var(--surface-glass)] p-4 text-foreground">
                  <p><strong>Email:</strong> <a href="mailto:hello@rive.work" className="text-primary hover:underline">hello@rive.work</a></p>
                  <p className="mt-1"><strong>Response time:</strong> Within 72 hours</p>
                </div>
              </Section>

            </div>
          </div>
      </div>
    </ProseShell>
  );
}
