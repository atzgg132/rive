import crypto from "node:crypto";
import { checkServerIdentity } from "node:tls";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const email = process.argv.find((value) => value.startsWith("--email="))?.slice(8).trim().toLowerCase();
const apply = process.argv.includes("--apply");
if (!email || !process.env.DATABASE_URL) throw new Error("Pass --email and DATABASE_URL.");
if (apply && !process.env.ASSET_BUCKET) throw new Error("ASSET_BUCKET is required when applying uploads.");
const parsedConnection = new URL(process.env.DATABASE_URL);
for (const parameter of ["channel_binding", "sslmode", "sslrootcert", "sslcert", "sslkey"]) parsedConnection.searchParams.delete(parameter);
const sslServerName = process.env.DATABASE_SSL_SERVERNAME || "";
const pool = new Pool({ connectionString: parsedConnection.toString(), ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true", ...(sslServerName ? { checkServerIdentity: (_hostname, certificate) => checkServerIdentity(sslServerName, certificate) } : {}) } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const s3 = new S3Client({ region: process.env.AWS_REGION || "ap-south-1" });

function uuid(key) {
  const value = crypto.createHash("sha256").update(`rive-portfolio-showcase:${key}`).digest("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-a${value.slice(17, 20)}-${value.slice(20, 32)}`;
}

const uploads = [
  { id: uuid("image"), kind: "image", extension: "jpg", contentType: "image/jpeg", source: "https://picsum.photos/id/1067/1600/1000", caption: "Native image upload — editorial workspace study." },
  { id: uuid("video"), kind: "video", extension: "mp4", contentType: "video/mp4", source: "https://www.w3schools.com/html/mov_bbb.mp4", caption: "Native MP4 upload — motion and playback demonstration.", durationSeconds: 10.03 },
  { id: uuid("audio"), kind: "audio", extension: "mp3", contentType: "audio/mpeg", source: "https://www.w3schools.com/html/horse.mp3", caption: "Native MP3 upload — audio player and waveform demonstration.", durationSeconds: 1.7 },
  { id: uuid("document"), kind: "document", extension: "pdf", contentType: "application/pdf", source: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", caption: "Native PDF upload — inline document preview and download." },
];

const embeds = [
  { id: "showcase-youtube", kind: "embed", provider: "youtube", url: "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?rel=0&modestbranding=1&playsinline=1", sourceUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", posterUrl: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg", alt: "Big Buck Bunny video embed", caption: "YouTube embed — responsive player with poster artwork.", aspectRatio: 1.7778 },
  { id: "showcase-vimeo", kind: "embed", provider: "vimeo", url: "https://player.vimeo.com/video/76979871?dnt=1&title=0&byline=0&portrait=0", sourceUrl: "https://vimeo.com/76979871", alt: "Vimeo motion design embed", caption: "Vimeo embed — privacy-aware playback.", aspectRatio: 1.7778 },
  { id: "showcase-soundcloud", kind: "embed", provider: "soundcloud", url: "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Ffreetousesounds%2Fforest-birds-singing", sourceUrl: "https://soundcloud.com/freetousesounds/forest-birds-singing", alt: "SoundCloud nature recording", caption: "SoundCloud embed — compact audio presentation.", embedHeight: 166 },
  { id: "showcase-spotify", kind: "embed", provider: "spotify", url: "https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT", sourceUrl: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT", alt: "Spotify track embed", caption: "Spotify embed — provider-native audio controls.", embedHeight: 152 },
];

async function uploadAssets(userId) {
  const media = [];
  for (const upload of uploads) {
    const key = `portfolio/${userId}/${upload.id}.${upload.extension}`;
    const response = await fetch(upload.source);
    if (!response.ok) throw new Error(`Could not download ${upload.source}: ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    await s3.send(new PutObjectCommand({ Bucket: process.env.ASSET_BUCKET, Key: key, Body: body, ContentType: upload.contentType }));
    await prisma.portfolioAsset.upsert({ where: { key }, create: { id: upload.id, userId, key, kind: upload.kind, contentType: upload.contentType, bytes: body.length, status: "ready", confirmedAt: new Date() }, update: { kind: upload.kind, contentType: upload.contentType, bytes: body.length, status: "ready", confirmedAt: new Date() } });
    media.push({ id: upload.id, kind: upload.kind, url: `/api/public/assets/${key}`, alt: upload.caption, caption: upload.caption, bytes: body.length, durationSeconds: upload.durationSeconds, ...(upload.kind === "audio" ? { peaks: [0.12,0.28,0.55,0.83,0.62,0.38,0.74,0.91,0.58,0.31,0.18,0.46,0.69,0.41,0.22] } : {}), ...(upload.kind === "video" || upload.kind === "image" ? { aspectRatio: 1.6 } : {}) });
  }
  return media;
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email }, include: { portfolio: true } });
  if (!user) throw new Error(`No user exists for ${email}.`);
  console.log(JSON.stringify({ mode: apply ? "apply" : "inspect", email, userId: user.id, portfolio: user.portfolio?.slug || null }, null, 2));
  if (!apply) return;
  const native = await uploadAssets(user.id);
  const practices = [
    { id: "practice-product", slug: "product-design", name: "Product & web", tagline: "Clear systems, useful interfaces, production craft.", description: "Strategy, UX, visual systems, and full-stack delivery for ambitious digital products.", accent: "#2563EB", coverMediaId: native[0].id, order: 0, visibility: "public" },
    { id: "practice-media", slug: "media-lab", name: "Media lab", tagline: "Stories that move, play, and invite exploration.", description: "A demonstration of every rich-media format supported by the portfolio experience.", accent: "#F97316", coverMediaId: native[1].id, order: 1, visibility: "public" },
  ];
  const projects = [
    { id: "showcase-mixed-media", title: "The all-media field guide", description: "A format-rich case study showing native uploads and zero-storage embeds together in one polished story.", role: "Creative director & builder", year: "2026", url: "https://www.rive.work", imageUrl: native[0].url, client: "Rive Media Lab", timeline: "Two-week concept sprint", deliverables: ["Creative direction", "Motion study", "Sound design", "Interactive case study"], media: [...native, ...embeds], gallery: native.filter((item) => item.kind === "image").map(({ id, url, alt, caption }) => ({ id, url, alt, caption })), visibility: "public", challenge: "Most portfolios flatten multidisciplinary work into a grid of silent thumbnails.", solution: "Designed a narrative case study where images, native video, audio, documents, and embeds each use a purpose-built presentation.", outcome: "One project demonstrates the complete media system, responsive layouts, descriptions, playback controls, and source attribution.", tools: ["Art direction", "Video", "Audio", "Editorial design", "Next.js"], practiceId: "practice-media" },
    { id: "showcase-product-system", title: "Rive — operating system for independent work", description: "A connected workspace spanning clients, delivery, finances, calendar, insights, and public presence.", role: "Founder, product designer & full-stack engineer", year: "2026", url: "https://www.rive.work", imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=85", client: "Rive", timeline: "Ongoing", deliverables: ["Product strategy", "UX architecture", "Design system", "Full-stack implementation"], media: [{ id: "showcase-product-image", kind: "image", url: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=85", alt: "Team collaborating around a product strategy wall", caption: "Product strategy and systems thinking in practice.", aspectRatio: 1.5 }, embeds[0]], visibility: "public", challenge: "Independent businesses lose context across disconnected operational tools.", solution: "Built one coherent system with shared data and workflows across the whole client lifecycle.", outcome: "A production platform that turns fragmented admin into an intelligible operating rhythm.", tools: ["Next.js", "TypeScript", "PostgreSQL", "Prisma", "AWS"], practiceId: "practice-product" },
    { id: "showcase-editorial-site", title: "Northstar — editorial launch experience", description: "A confident, conversion-focused web presence balancing product clarity with strong visual pacing.", role: "Designer & developer", year: "2026", url: "", imageUrl: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1600&q=85", client: "Synthetic demo client", timeline: "8 weeks", deliverables: ["Positioning", "Responsive design", "Frontend", "Launch system"], media: [{ id: "showcase-office-image", kind: "image", url: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1600&q=85", alt: "Bright modern creative studio interior", caption: "A direction built around light, space, and decisive typography.", aspectRatio: 1.5 }, embeds[1]], visibility: "public", challenge: "A technically strong product lacked an immediate, memorable story.", solution: "Reframed the experience around outcomes and built an editorial page system with clear conversion moments.", outcome: "A launch-ready identity and site system designed to scale with new campaigns and proof points.", tools: ["Figma", "Responsive design", "React", "SEO"], practiceId: "practice-product" },
  ];
  const content = {
    name: "Arnav Bhattacharya", profileImageUrl: "https://images.unsplash.com/photo-1531384441138-2736e62e0919?auto=format&fit=crop&w=600&q=85", headline: "I design products, build on the web, and tell stories through every medium.", bio: "Independent product designer and full-stack builder creating thoughtful digital systems from Bengaluru for teams worldwide. This portfolio demonstrates rich case studies—from imagery and documents to native video, audio, and embedded media.", location: "Bengaluru, India · working worldwide", availability: "Available for select product, web, and creative technology engagements", contactEmail: email,
    social: [{ label: "Rive", url: "https://www.rive.work" }, { label: "GitHub", url: "https://github.com" }, { label: "LinkedIn", url: "https://www.linkedin.com" }], projects,
    services: [{ id: "service-product", title: "Product strategy & design", description: "From ambiguous problem to a clear product system, validated flow, and implementation-ready interface.", practiceId: "practice-product" }, { id: "service-build", title: "Full-stack product builds", description: "Production web applications spanning polished frontend, APIs, data, infrastructure, and operations.", practiceId: "practice-product" }, { id: "service-story", title: "Rich-media storytelling", description: "Format-aware digital stories combining editorial design, video, audio, embeds, and interactive presentation.", practiceId: "practice-media" }, { id: "service-audit", title: "UX & conversion audits", description: "Focused diagnosis with a prioritized path from friction to measurable improvement." }],
    testimonials: [{ id: "testimonial-northstar", quote: "Arnav translated complexity into a product story our whole team could finally rally around.", name: "Maya Rao", company: "Northstar Labs · synthetic demo", role: "Founder", projectId: "showcase-editorial-site", source: "Synthetic seed data", visibility: "public", practiceId: "practice-product" }, { id: "testimonial-media", quote: "The work feels cinematic without sacrificing clarity or usability—every format earns its place.", name: "Ira Sen", company: "Field Notes Studio · synthetic demo", role: "Creative Director", projectId: "showcase-mixed-media", source: "Synthetic seed data", visibility: "public", practiceId: "practice-media" }],
    sections: ["about", "projects", "services", "testimonials", "contact"].map((key) => ({ key, visible: true })), practices, practiceLayout: "unified", mediaSettings: { autoplayOnScroll: false, loop: true, hoverPreview: true, lightbox: true, layout: "masonry", fit: "cover", showCaptions: true },
  };
  const portfolioId = user.portfolio?.id || uuid(`portfolio:${user.id}`);
  await prisma.portfolio.upsert({ where: { userId: user.id }, create: { id: portfolioId, userId: user.id, slug: "atzgg132", status: "published", publishedAt: new Date(), templateKey: "visual-studio", content, theme: { accent: "#F97316", mode: "dark", radius: "soft" }, seo: { title: "Arnav Bhattacharya — Product, Web & Media", description: "Product design, full-stack web development, and rich-media storytelling from Bengaluru to teams worldwide.", indexable: false } }, update: { status: "published", publishedAt: user.portfolio?.publishedAt || new Date(), templateKey: "visual-studio", content, theme: { accent: "#F97316", mode: "dark", radius: "soft" }, seo: { title: "Arnav Bhattacharya — Product, Web & Media", description: "Product design, full-stack web development, and rich-media storytelling from Bengaluru to teams worldwide.", indexable: false }, revision: { increment: 1 } } });
  console.log(JSON.stringify({ success: true, email, slug: user.portfolio?.slug || "atzgg132", nativeUploads: native.map(({ kind, bytes }) => ({ kind, bytes })), embeds: embeds.map(({ provider }) => provider), projects: projects.length, practices: practices.length }, null, 2));
}

try { await main(); } finally { await prisma.$disconnect(); await pool.end(); }
