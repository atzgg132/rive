export const contactContent = {
  eyebrow: "ONE INBOX",
  title: "Bring us the part of the work that refuses to stay connected.",
  intro: "Questions, support, press, partnerships, or a workflow that keeps breaking. Give us the concrete version; it reaches the people building Rive.",
  asideTitle: "Write directly",
  asideBody: "For questions, support, press, or anything else that needs a human answer.",
  email: "hello@rive.work",
  form: {
    nameLabel: "Name",
    namePlaceholder: "Your name",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    subjectLabel: "Subject",
    subjects: ["General Inquiry", "Partnership", "Press", "Feedback", "Bug Report"],
    messageLabel: "Message",
    messagePlaceholder: "Tell us what happened, what you expected, and where the context broke.",
    submitLabel: "Send message",
    submittingLabel: "Sending…",
    successTitle: "Message received.",
    successBody: "A human will reply within 24 hours.",
    fallbackError: "Your message could not be sent.",
  },
} as const;

export const docsContent = {
  eyebrow: "DOCUMENTATION",
  title: "The shortest path from scattered records to connected work.",
  intro: "Start with one client, follow the context through delivery and money, then make the completed work useful again.",
  snippet: {
    label: "Create an account",
    language: "HTTP",
    code: `POST /api/auth/register
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
}`,
  },
  sections: [
    { id: "getting-started", title: "Getting started", body: "Create a free account, verify your email, then open the workspace overview. Every client, project, Agreement, invoice, expense, and portfolio record is scoped to your account." },
    { id: "core-concepts", title: "Core concepts", body: "Clients own the relationship. Projects track delivery. Agreements capture scope, review, and recorded acceptance. Invoices track money owed. Expenses track costs. Calendar and dashboard views reuse those same records." },
    { id: "workflow", title: "A connected workflow", body: "Start with a client, create a project, add milestones, optionally send an Agreement for review, issue invoices, and record expenses. Paid invoices and expenses roll into net earnings. Completed work can become public portfolio proof." },
    { id: "imports", title: "Imports and calendars", body: "Bring clients, projects, invoices, and expenses in from CSV or XLSX. The Migration Engine previews matches and can roll a commit back. Subscribe to a private Apple Calendar feed of Rive deadlines. Zoho Books import is available when connected." },
    { id: "api", title: "Application API", body: "There is no public API or webhook product in open beta. Routes under /api power the workspace itself and use the Rive session cookie. Public invoice links, public portfolio pages, and the rates preview are the deliberate unauthenticated surfaces." },
  ],
  cta: { label: "Create your workspace", href: "/register" },
} as const;

export const apiReferenceContent = {
  eyebrow: "APPLICATION API",
  title: "The routes behind Rive, documented without pretending they are a public platform.",
  intro: "These endpoints power the signed-in workspace. They use Rive session authentication and are not a public integration contract. A supported public API remains later-roadmap work.",
  notice: "SESSION COOKIE · NOT A PUBLIC INTEGRATION CONTRACT",
  endpoints: [
    { method: "GET", path: "/api/workflow/clients", description: "List clients for the signed-in workspace" },
    { method: "GET", path: "/api/workflow/projects", description: "List projects, milestones, and delivery context" },
    { method: "GET", path: "/api/workflow/contracts", description: "List Agreements for review, acceptance, and billing" },
    { method: "GET", path: "/api/workflow/invoices", description: "List invoices, payment history, and outstanding balance" },
    { method: "GET", path: "/api/calendar/events", description: "Read the connected workspace calendar" },
    { method: "GET", path: "/api/portfolio", description: "Read the signed-in portfolio draft and publish state" },
    { method: "POST", path: "/api/migrations", description: "Start a CSV, XLSX, or connector import through the Migration Engine" },
    { method: "GET", path: "/api/rates", description: "Read indicative exchange rates for workspace display; not a transfer API" },
  ],
  cta: { label: "Read the workspace guide", href: "/docs" },
} as const;

export const guidesContent = {
  eyebrow: "LEARN BY DOING",
  title: "Learn Rive through the outcome you need next.",
  intro: "Each guide begins with real work and ends with a verifiable result. No tour of every button. No invented sample business.",
  agreement: {
    id: "agreements",
    label: "Reviewing and recording an Agreement",
    description: "Draft from client and project context, share a review link, and connect accepted terms to billing.",
    outcome: "Client → Agreement → invoice, with the decision recorded.",
    duration: "4 min",
    goal: "organize",
    flow: ["Client", "Agreement", "Invoice"],
  },
  accountTitle: "Already have an account?",
  accountBody: "Open Help & Guides inside the workspace. Progress follows the records you actually create.",
  accountCta: { label: "Open the workspace", href: "/login" },
} as const;
