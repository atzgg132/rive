import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { checkServerIdentity } from "node:tls";

const email = process.env.E2E_USER_EMAIL?.trim().toLowerCase();
const visualPortfolioContent = {
  name: "Rive Visual Tester",
  profileImageUrl: "",
  headline: "Independent product designer building calm, useful software.",
  bio: "I help small teams shape focused products and ship dependable experiences.",
  location: "Bengaluru, India",
  availability: "Available for select product engagements",
  contactEmail: "visual@rive.test",
  social: [],
  projects: [{ id: "project-1", title: "Connected workspace", description: "A focused operating system for independent work.", role: "Product design", year: "2026", url: "", imageUrl: "", client: "Rive", timeline: "8 weeks", deliverables: ["Product design"], gallery: [], visibility: "public", challenge: "", solution: "", outcome: "", tools: ["Figma"] }],
  services: [{ id: "service-1", title: "Product design", description: "From product direction through production-ready interface design." }],
  testimonials: [],
  sections: [{ key: "about", visible: true }, { key: "projects", visible: true }, { key: "services", visible: true }, { key: "testimonials", visible: false }, { key: "contact", visible: true }],
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("E2E_USER_EMAIL must be a valid email address.");
}

const sslServerName = process.env.DATABASE_SSL_SERVERNAME || "";
const parsedConnectionString = new URL(process.env.DATABASE_URL);
for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) parsedConnectionString.searchParams.delete(parameter);
const ssl =
  process.env.DATABASE_SSL === "disable" ||
  process.env.DATABASE_URL.includes("sslmode=disable")
    ? false
    : {
        rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
        ...(sslServerName ? { checkServerIdentity: (_hostname, certificate) => checkServerIdentity(sslServerName, certificate) } : {}),
      };
const pool = new Pool({ connectionString: parsedConnectionString.toString(), ssl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Rive E2E User",
      passwordHash: "e2e-session-authentication-does-not-use-this-password",
      plan: "pro",
      onboardingStatus: "complete",
      onboardingStep: 5,
      businessType: "freelancer",
      profession: "Product designer",
      currency: "USD",
      timeZone: "UTC",
    },
    update: {
      name: "Rive E2E User",
      plan: "pro",
      onboardingStatus: "complete",
      onboardingStep: 5,
    },
  });

  await prisma.calendar.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      userId: user.id,
      name: "Rive",
      timeZone: "UTC",
      isDefault: true,
    },
    update: {
      userId: user.id,
      name: "Rive",
      timeZone: "UTC",
      isDefault: true,
    },
  });

  await prisma.portfolio.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      slug: "e2e-workspace-portfolio",
      status: "published",
      templateKey: "minimal-pro",
      publishedAt: new Date("2026-08-10T09:00:00.000Z"),
      content: visualPortfolioContent,
      theme: { accent: "#2563EB", mode: "light", radius: "soft" },
      seo: { title: "Rive Visual Tester", description: "Independent product designer", indexable: false },
    },
    update: {
      slug: "e2e-workspace-portfolio",
      status: "published",
      templateKey: "minimal-pro",
      publishedAt: new Date("2026-08-10T09:00:00.000Z"),
      content: visualPortfolioContent,
      theme: { accent: "#2563EB", mode: "light", radius: "soft" },
      seo: { title: "Rive Visual Tester", description: "Independent product designer", indexable: false },
    },
  });

  console.log(`Seeded authenticated E2E user ${email}.`);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
