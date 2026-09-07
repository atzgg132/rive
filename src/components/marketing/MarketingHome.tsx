import Link from "next/link";
import { ArrowDown, ArrowRight, Check } from "lucide-react";
import { HeroClientStage, ProductQuestionStage } from "@/components/marketing/WorkingEditionStage";
import { PortfolioShowcase } from "@/components/marketing/PortfolioShowcase";
import { EditorialLabel, MarketingButton } from "@/components/marketing/primitives";

const startSteps = [
  { number: "01", title: "Add a client", body: "Keep their details in one place." },
  { number: "02", title: "Create a project", body: "Give the work a name and track its deadlines." },
  { number: "03", title: "Use it for the next job", body: "Add the agreement, invoice, or expense you need." },
] as const;

const included = [
  "Clients, projects, tasks, and milestones",
  "Agreements and recorded acceptance",
  "Invoices, payment records, and expenses",
  "Calendar and Apple Calendar feed",
  "Portfolio publishing and enquiries",
] as const;

const questions = [
  { question: "Who is Rive for?", answer: "Rive is for freelancers and independent service businesses managing several clients. It can also suit a small-studio owner who manages the operation personally." },
  { question: "Can my team share a workspace?", answer: "Not yet. Rive currently supports one operator per account, without shared team roles or permissions." },
  { question: "Does Rive collect payments?", answer: "No. You can create invoices and record payments and expenses. Payment collection and transfers are not currently available." },
  { question: "What can I do with agreements?", answer: "Prepare an agreement, share it for review, record acceptance, and connect it to billing. Rive does not guarantee that an agreement is enforceable in every jurisdiction." },
  { question: "Can I import existing records?", answer: "CSV and XLSX imports support clients, projects, invoices, and expenses. Check the import page for current availability and limits." },
  { question: "What about exports and integrations?", answer: "Full workspace export is not currently available. An Apple Calendar subscription feed is available; Google Calendar is not currently available." },
] as const;

export function MarketingHome() {
  return (
    <>
      <section data-testid="marketing-hero" className="edition-hero">
        <div className="edition-container edition-hero__grid">
          <div className="edition-hero__copy">
            <EditorialLabel>For independent businesses managing multiple clients</EditorialLabel>
            <h1 className="edition-display"><span>Multiple clients.</span><span>One clear picture.</span></h1>
            <p className="marketing-hero-body">One workspace for clients, projects, agreements, invoices, and expenses. Rive keeps track of what’s due, what’s agreed, and what’s outstanding.</p>
            <div className="edition-hero__actions">
              <MarketingButton href="/register">Start free</MarketingButton>
              <Link href="#product" className="marketing-focus edition-text-link">Explore the product <ArrowDown className="h-4 w-4" aria-hidden="true" /></Link>
            </div>
            <p className="edition-assurance"><Check className="h-4 w-4" aria-hidden="true" /> Free during beta. No credit card required.</p>
          </div>
          <HeroClientStage />
        </div>
      </section>

      <section id="product" className="edition-product-section">
        <div className="edition-container">
          <div className="edition-product-intro"><EditorialLabel inverse>Inside Rive</EditorialLabel><h2 className="edition-display">What needs your attention?</h2><p>A deadline, an agreement, an invoice. Find the details in the same place you manage the client.</p></div>
          <ProductQuestionStage />
        </div>
      </section>

      <section className="edition-portfolio-section">
        <div className="edition-container">
          <div className="edition-section-heading"><EditorialLabel>Portfolio Studio</EditorialLabel><h2 className="edition-display">Make room for the work you want to show.</h2><div><p>Build a public portfolio in Rive. Choose the projects to publish, present your services, and give prospective clients a way to enquire.</p><Link href="/product/portfolio" className="marketing-focus edition-text-link">Explore Portfolio Studio <ArrowRight className="h-4 w-4" /></Link></div></div>
          <PortfolioShowcase />
          <p className="edition-figure-caption">Example portfolio · Built with Rive · Sample work</p>
        </div>
      </section>

      <section className="edition-start-section">
        <div className="edition-container">
          <div className="edition-section-heading edition-section-heading--compact"><EditorialLabel>Starting is deliberately small</EditorialLabel><h2 className="edition-display">Start with one client. Not a migration project.</h2><p>You don’t need to reorganize your whole business to try Rive. Add one client, create a project, and use it for a real piece of work.</p></div>
          <ol className="edition-steps">
            {startSteps.map((step) => <li key={step.number}><span>{step.number}</span><h3>{step.title}</h3><p>{step.body}</p></li>)}
          </ol>
          <div className="edition-start-actions"><MarketingButton href="/register">Start free</MarketingButton><Link href="/migrate-to-rive" className="marketing-focus edition-text-link">Have existing records? Explore importing <ArrowRight className="h-4 w-4" /></Link></div>
        </div>
      </section>

      <section id="pricing" className="edition-pricing-section">
        <div className="edition-container edition-pricing-grid">
          <div><EditorialLabel>Open beta</EditorialLabel><h2 className="edition-display">Try Rive with real work.</h2><div className="edition-price"><strong>Free</strong><span>during open beta</span></div></div>
          <div className="edition-pricing-detail">
            <p>Create a Rive account without a credit card. Use the current workspace while the product is in open beta.</p>
            <ul>{included.map((item) => <li key={item}><Check className="h-4 w-4" aria-hidden="true" />{item}</li>)}</ul>
            <div className="edition-boundary"><strong>Account scope</strong><p>One account for the person running the business. Shared team access is not available yet.</p></div>
            <MarketingButton href="/register">Create your free account</MarketingButton>
            <Link href="/pricing" className="marketing-focus edition-text-link">See pricing & beta details <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <section id="faq" className="edition-faq-section">
        <div className="edition-container edition-faq-grid">
          <div><EditorialLabel>Straight answers</EditorialLabel><h2 className="edition-display">A few things worth knowing.</h2></div>
          <div data-testid="faq-grid" className="edition-faq-list">
            {questions.map((item, index) => <details key={item.question} open={index === 0}><summary><span>0{index + 1}</span><h3>{item.question}</h3><span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}
          </div>
        </div>
      </section>

      <section className="edition-closing-section">
        <div className="edition-container"><EditorialLabel inverse>Open beta</EditorialLabel><h2 className="edition-display">Your next client project<br />can start here.</h2><div className="edition-closing-action"><p>Create your account, add a client, and put Rive to work.</p><MarketingButton href="/register" variant="primary">Start free</MarketingButton><small>Free during beta. No credit card required.</small></div></div>
      </section>
    </>
  );
}
