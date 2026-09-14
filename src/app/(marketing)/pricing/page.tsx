import { Check } from "lucide-react";
import { InstMark, MarketingButton } from "@/components/marketing/primitives";
import { ClosingCta, ReadingHero } from "@/components/marketing/shells";
import { marketingMetadata } from "@/lib/marketingMetadata";

export const metadata = marketingMetadata("Rive pricing — Free during open beta", "Create a Rive account without a credit card and use one complete workspace free during open beta.", "/pricing");

const included = ["Client and project management", "Tasks, milestones, and calendar", "Agreement review and recorded acceptance", "Invoices, payment records, and expenses", "Portfolio publishing and enquiries"];
const questions = [
  ["What does beta mean?", "Features may change as Rive develops. Paid pricing will be published before beta ends."],
  ["Is this a team plan?", "No. Rive currently supports one operator per account. Shared workspaces, roles, and team permissions are not available."],
  ["Do I need a credit card?", "No credit card is required to create an account during beta."],
  ["Will it stay free forever?", "Free access applies during beta. Paid pricing has not yet been published."],
  ["Can I export my whole workspace?", "Full workspace export is not currently available. Review this limitation before moving essential business records."],
] as const;

export default function PricingPage() {
  return (
    <>
      <ReadingHero
        eyebrow="Fee schedule"
        title={<>Free during beta.<br />Clear about what&rsquo;s included.</>}
        intro="Create a Rive account without a credit card. Use the current workspace while the product is in open beta."
      />
      <section className="inst-section" aria-label="The plan">
        <div className="inst-container inst-admit">
          <div className="inst-admit__fee">
            <div className="inst-admit__fee-head">
              <span className="inst-mono"><InstMark mark="square" accent />Open beta</span>
              <span className="inst-mono">No card</span>
            </div>
            <span className="inst-admit__fee-value">Free</span>
            <span className="inst-admit__fee-sub">One complete workspace during open beta.</span>
            <div className="inst-admit__fee-foot">
              <MarketingButton href="/register">Create your free account</MarketingButton>
            </div>
          </div>
          <div>
            <h2 className="inst-display inst-display--sub">One workspace for the person running the business.</h2>
            <ul className="inst-admit__list">
              {included.map((item) => (
                <li key={item}>
                  <Check className="h-4 w-4" aria-hidden="true" style={{ color: "var(--inst-accent)" }} />
                  {item}
                </li>
              ))}
            </ul>
            <p className="inst-admit__note">One operator per account. Shared team access is not available yet.</p>
          </div>
        </div>
      </section>
      <section className="inst-section" aria-label="Before you start">
        <div className="inst-container">
          <div className="inst-dept"><span className="inst-mono">Before you start</span><span className="inst-mono">On the record</span></div>
          <div className="inst-register" style={{ borderTop: 0, marginTop: "1rem" }}>
            {questions.map(([question, answer], index) => (
              <div key={question} className="inst-register__row">
                <span className="inst-mono">Q{index + 1}</span>
                <span className="inst-register__name">{question}</span>
                <span className="inst-register__detail">{answer}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <ClosingCta headline="Use Rive with real work." note="Start with one client. No credit card required." href="/register" label="Start free" />
    </>
  );
}
