"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, CircleDollarSign, MapPin, Sparkles } from "lucide-react";
import { WorkspacePreview, type WorkspacePreviewView } from "@/components/marketing/WorkspacePreview";

export function ClientScene({ selected = 0 }: { selected?: number }) {
  const views: WorkspacePreviewView[] = ["clients", "projects", "calendar"];
  return <WorkspacePreview view={views[selected] ?? "clients"} />;
}

export function HeroClientStage() {
  return (
    <div className="edition-hero-stage" data-testid="hero-client-stage">
      <div className="edition-preview-label"><span>Inside Rive</span></div>
      <WorkspacePreview view="dashboard" />
    </div>
  );
}

const questions = [
  { id: "due", tab: "What’s due?", title: "Keep the work in view.", body: "Track projects, tasks, and milestones for each client. Use the calendar to see the deadlines attached to your work.", note: "Clients & projects", view: "projects" },
  { id: "agreed", tab: "What’s agreed?", title: "Know what you’re delivering.", body: "Prepare agreements, share them for review, and record acceptance. Keep the terms linked to the client and project.", note: "Agreements", view: "agreements" },
  { id: "outstanding", tab: "What’s outstanding?", title: "Keep an eye on the money.", body: "Create invoices, record payments, and log expenses against the work they belong to.", note: "Revenue & invoices", view: "revenue" },
] as const;

export function ProductQuestionStage() {
  const [active, setActive] = useState<(typeof questions)[number]["id"]>("due");
  const current = questions.find((question) => question.id === active) ?? questions[0];
  return (
    <div className="edition-question-stage">
      <div className="edition-question-tabs" role="tablist" aria-label="Questions Rive helps answer">
        {questions.map((question, index) => (
          <button key={question.id} id={`question-tab-${question.id}`} type="button" role="tab" aria-selected={active === question.id} aria-controls={`question-panel-${question.id}`} onClick={() => setActive(question.id)}>
            <span>0{index + 1}</span>{question.tab}
          </button>
        ))}
      </div>
      <div className="edition-question-copy" id={`question-panel-${active}`} role="tabpanel" aria-labelledby={`question-tab-${active}`}>
        <p className="edition-kicker edition-kicker--inverse">{current.note}</p>
        <h3 className="edition-display">{current.title}</h3>
        <p>{current.body}</p>
        {active === "outstanding" ? <small><CircleDollarSign className="h-4 w-4" /> Payments are recorded in Rive; Rive does not currently collect or transfer funds.</small> : null}
        <Link href={active === "due" ? "/product/clients-projects" : "/product/agreements-invoices"}>Explore {current.note.toLowerCase()} <ArrowRight className="h-4 w-4" /></Link>
      </div>
      <div key={active} className="edition-question-visual"><WorkspacePreview view={current.view} /></div>
    </div>
  );
}

export function PortfolioPublication() {
  return (
    <div className="edition-portfolio-publication" data-testid="portfolio-publication">
      <header><strong>Maya Rao<span>.</span></strong><nav><span>Work</span><span>Services</span><span>About</span><b>Let’s talk <ArrowUpRight /></b></nav></header>
      <section>
        <div className="edition-public-status"><span><Sparkles /> Independent professional</span><span><i />Available for select product engagements</span></div>
        <h3>Independent product designer building calm, useful software.</h3>
        <p>I help small teams shape focused products and ship dependable experiences.</p>
        <div className="edition-public-actions"><b>Start a conversation <ArrowUpRight /></b><span><MapPin /> Bengaluru, India</span></div>
      </section>
      <div className="edition-public-stats"><span><b>02</b><small>Selected projects</small></span><span><b>02</b><small>Core services</small></span><span><b>Bengaluru</b><small>Where I work</small></span><span><b>Available</b><small>Current status</small></span></div>
    </div>
  );
}
