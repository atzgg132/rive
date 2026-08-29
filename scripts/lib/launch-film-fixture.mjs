import crypto from "node:crypto";

const NAMESPACE = "rive-launch-film";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function stableUuid(key) {
  const hex = crypto.createHash("sha256").update(`${NAMESPACE}:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function at(value) {
  return new Date(value);
}

const client = {
  key: "northstar",
  name: "Maya Rao",
  email: "maya@northstarstudio.example",
  phone: "+91 98000 10421",
  company: "Northstar Studio",
  website: "https://northstarstudio.example",
  address: "Bengaluru, Karnataka",
  avatarColor: "#1D4ED8",
  tags: ["brand", "identity", "retainer"],
  status: "active",
  notes: "Synthetic launch-film demo client. Do not treat as a real customer. Prefers weekly reviews and a single source of truth for scope.",
  createdAt: at("2026-03-10T09:30:00+05:30"),
};

const project = {
  key: "brand-system",
  clientKey: client.key,
  title: "Northstar Brand System",
  description: "A complete brand system for Northstar Studio: positioning, visual language, templates, and launch assets. Synthetic launch-film fixture.",
  status: "active",
  priority: "high",
  startDate: at("2026-03-12T00:00:00+05:30"),
  dueDate: at("2026-08-28T18:00:00+05:30"),
  budget: 240_000,
  tags: ["brand system", "identity", "delivery"],
  createdAt: at("2026-03-12T10:00:00+05:30"),
};

const invoices = [
  {
    key: "paid",
    number: "NS-1001",
    status: "paid",
    total: 160_000,
    issueDate: at("2026-05-02T10:00:00+05:30"),
    dueDate: at("2026-05-16T18:00:00+05:30"),
    paidDate: at("2026-05-14T11:20:00+05:30"),
    sentAt: at("2026-05-02T10:15:00+05:30"),
    items: [
      { description: "Discovery — research, audit, and positioning", amount: 80_000 },
      { description: "Direction — visual language and system principles", amount: 80_000 },
    ],
  },
  {
    key: "outstanding",
    number: "NS-1002",
    status: "sent",
    total: 80_000,
    issueDate: at("2026-08-18T10:00:00+05:30"),
    dueDate: at("2026-09-01T18:00:00+05:30"),
    paidDate: null,
    sentAt: at("2026-08-18T10:12:00+05:30"),
    items: [{ description: "Final delivery — production files and rollout kit", amount: 80_000 }],
  },
];

export const FIXTURE = {
  currency: "INR",
  timeZone: "Asia/Kolkata",
  dataOrigin: "synthetic",
  notesIdentifySynthetic: true,
  operator: {
    name: "Asha Iyer",
    profession: "Independent brand designer",
    businessType: "freelancer",
  },
  client,
  project,
  clients: [client],
  projects: [project],
  financials: {
    projectValue: 240_000,
    paid: 160_000,
    outstanding: 80_000,
    expenses: 32_000,
  },
  milestones: [
    {
      key: "discovery",
      title: "Discovery",
      dueDate: at("2026-04-04T18:00:00+05:30"),
      completed: true,
      completedAt: at("2026-04-03T16:00:00+05:30"),
    },
    {
      key: "direction",
      title: "Direction",
      dueDate: at("2026-05-16T18:00:00+05:30"),
      completed: true,
      completedAt: at("2026-05-15T17:30:00+05:30"),
    },
    {
      key: "final",
      title: "Final delivery",
      dueDate: at("2026-08-28T18:00:00+05:30"),
      completed: false,
      completedAt: at("2026-08-22T15:00:00+05:30"),
    },
  ],
  tasks: [
    {
      key: "audit",
      milestoneKey: "discovery",
      title: "Audit current Northstar brand touchpoints",
      status: "done",
      priority: "high",
      dueDate: at("2026-03-28T18:00:00+05:30"),
      estimatedMinutes: 240,
      billable: true,
      completedAt: at("2026-03-27T17:00:00+05:30"),
      projectKey: project.key,
    },
    {
      key: "direction-review",
      milestoneKey: "direction",
      title: "Present direction board to Maya Rao",
      status: "done",
      priority: "high",
      dueDate: at("2026-05-12T16:00:00+05:30"),
      estimatedMinutes: 90,
      billable: true,
      completedAt: at("2026-05-12T16:20:00+05:30"),
      projectKey: project.key,
    },
    {
      key: "production",
      milestoneKey: "final",
      title: "Produce final logo, type, and template kit",
      status: "in_progress",
      priority: "high",
      dueDate: at("2026-08-28T18:00:00+05:30"),
      estimatedMinutes: 480,
      billable: true,
      completedAt: null,
      projectKey: project.key,
    },
    {
      key: "handoff",
      milestoneKey: "final",
      title: "Package rollout notes for Northstar Studio",
      status: "todo",
      priority: "medium",
      dueDate: at("2026-08-28T18:00:00+05:30"),
      estimatedMinutes: 120,
      billable: true,
      completedAt: null,
      projectKey: project.key,
    },
  ],
  invoices,
  payments: [
    {
      key: "ns-1001",
      invoiceNumber: "NS-1001",
      invoiceKey: "paid",
      amount: 160_000,
      paidAt: at("2026-05-14T11:20:00+05:30"),
      method: "bank_transfer",
      reference: "NS-1001-SYNTHETIC",
      notes: "Synthetic launch-film payment ledger entry. Recorded in Rive; not processed by Rive.",
      idempotencyKey: "launch-film:ns-1001:payment",
    },
  ],
  expenses: [
    { key: "type", category: "software", description: "Type licensing for Northstar Brand System (synthetic)", amount: 12_000, date: at("2026-04-18T12:00:00+05:30"), projectKey: project.key, billable: true },
    { key: "print", category: "contractor", description: "Print proofs and photography for Northstar (synthetic)", amount: 14_000, date: at("2026-06-09T12:00:00+05:30"), projectKey: project.key, billable: true },
    { key: "stock", category: "software", description: "Asset library for rollout templates (synthetic)", amount: 6_000, date: at("2026-07-21T12:00:00+05:30"), projectKey: project.key, billable: false },
  ],
  calendarEvents: [
    {
      key: "final-review",
      title: "Northstar Brand System — final review",
      description: "Synthetic launch-film calendar event. Review production files with Maya Rao.",
      startAt: at("2026-08-26T16:00:00+05:30"),
      endAt: at("2026-08-26T17:00:00+05:30"),
    },
  ],
  portfolio: {
    project: {
      id: "northstar-brand-system",
      title: "Northstar Brand System",
      description: "A connected identity system for Northstar Studio, from positioning through production files.",
      role: "Brand designer",
      year: "2026",
      url: "",
      imageUrl: "",
      client: "Northstar Studio",
      timeline: "March — August 2026",
      deliverables: ["Positioning", "Visual language", "Templates", "Launch kit"],
      gallery: [],
      visibility: "public",
      challenge: "The studio's work was strong, but the story lived in slides, chats, and folders.",
      solution: "A single brand system with a clear voice, reusable templates, and a public case study.",
      outcome: "Northstar now has one identity to sell from, and one case study to show next.",
      tools: ["Figma", "Type", "Brand strategy"],
    },
    testimonial: {
      id: "testimonial-northstar-launch-film",
      quote: "Synthetic approved testimonial for the Rive launch film. Asha kept every decision attached to the work we had already agreed.",
      name: "Maya Rao",
      company: "Northstar Studio · synthetic demo",
      role: "Founder",
      projectId: "northstar-brand-system",
      source: "Synthetic launch-film seed data",
      visibility: "public",
    },
  },
  milestoneState(state) {
    const after = state === "after";
    return {
      discovery: { ...this.milestones[0], completed: true },
      direction: { ...this.milestones[1], completed: true },
      final: {
        ...this.milestones[2],
        completed: after,
        completedAt: after ? this.milestones[2].completedAt : null,
      },
    };
  },
};

export function fixtureIds() {
  return {
    client: stableUuid(`client:${client.key}`),
    project: stableUuid(`project:${project.key}`),
    milestones: {
      discovery: stableUuid("milestone:discovery"),
      direction: stableUuid("milestone:direction"),
      final: stableUuid("milestone:final"),
    },
    invoices: {
      paid: stableUuid("invoice:NS-1001"),
      outstanding: stableUuid("invoice:NS-1002"),
    },
    payment: stableUuid("invoice-payment:ns-1001"),
    tasks: Object.fromEntries(FIXTURE.tasks.map((task) => [task.key, stableUuid(`task:${task.key}`)])),
    expenses: Object.fromEntries(FIXTURE.expenses.map((expense) => [expense.key, stableUuid(`expense:${expense.key}`)])),
    calendarEvent: stableUuid("calendar-event:final-review"),
  };
}

export function parseSeedArgs(argv) {
  const emailArgument = argv.find((argument) => argument.startsWith("--email="));
  const email = emailArgument?.slice("--email=".length).trim().toLowerCase();
  if (!email || !EMAIL_PATTERN.test(email)) {
    throw new Error("Pass a valid target with --email=user@example.com.");
  }
  const stateArgument = argv.find((argument) => argument.startsWith("--state="));
  const state = stateArgument ? stateArgument.slice("--state=".length).trim() : "after";
  if (state !== "before" && state !== "after") {
    throw new Error("Pass --state=before or --state=after.");
  }
  return { email, apply: argv.includes("--apply"), state };
}

export function refuseProduction(env = process.env) {
  if (env.APP_ENV === "production" || env.NODE_ENV === "production") {
    throw new Error("The launch-film seed writes synthetic data and must never run against production.");
  }
  return true;
}

export function summarizeFixture() {
  const ids = fixtureIds();
  return {
    clientId: ids.client,
    projectId: ids.project,
    milestoneIds: ids.milestones,
    invoicePaidId: ids.invoices.paid,
    invoiceOutstandingId: ids.invoices.outstanding,
    paymentId: ids.payment,
    portfolioProjectId: FIXTURE.portfolio.project.id,
    counts: {
      clients: FIXTURE.clients.length,
      projects: FIXTURE.projects.length,
      milestones: FIXTURE.milestones.length,
      tasks: FIXTURE.tasks.length,
      invoices: FIXTURE.invoices.length,
      payments: FIXTURE.payments.length,
      expenses: FIXTURE.expenses.length,
    },
  };
}
