import { Check } from "lucide-react";
import { EditorialLabel, MarketingButton } from "@/components/marketing/primitives";
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
      <section className="edition-pricing-page"><div className="edition-container"><EditorialLabel>Pricing</EditorialLabel><h1 className="edition-display">Free during beta.<br /><em>Clear about what’s included.</em></h1><p>Create a Rive account without a credit card. Use the current workspace while the product is in open beta.</p></div></section>
      <section className="edition-plan"><div className="edition-container edition-plan__grid"><div><span>Open beta</span><strong className="edition-display">Free</strong><p>during open beta</p><MarketingButton href="/register">Create your free account</MarketingButton></div><div><h2>One workspace for the person running the business.</h2><ul>{included.map((item) => <li key={item}><Check className="h-4 w-4" />{item}</li>)}</ul></div></div></section>
      <section className="edition-pricing-questions"><div className="edition-container"><EditorialLabel>Before you start</EditorialLabel><div>{questions.map(([question, answer], index) => <article key={question}><span>0{index + 1}</span><h2>{question}</h2><p>{answer}</p></article>)}</div></div></section>
      <section className="edition-page-cta"><div className="edition-container"><h2 className="edition-display">Use Rive with real work.</h2><div><p>Start with one client. No credit card required.</p><MarketingButton href="/register">Start free</MarketingButton></div></div></section>
    </>
  );
}
