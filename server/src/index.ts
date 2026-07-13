import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { initDb, pool } from "./db";
import { waitlistSchema } from "./validators";

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Admin credentials ─────────────────────────────────────
const ADMIN_USERNAME = "Admin1";
const ADMIN_PASSWORD = "AdminPass1";

// In-memory token store: token → expiry (ms). Cleared on restart.
const adminTokens  = new Map<string, number>();
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function issueToken() {
  const token = crypto.randomBytes(32).toString("hex");
  adminTokens.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

function validateToken(token?: string) {
  if (!token) return false;
  const expiry = adminTokens.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) { adminTokens.delete(token); return false; }
  return true;
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!validateToken(req.headers["x-admin-token"] as string)) {
    res.status(401).json({ success: false, message: "unauthorised." });
    return;
  }
  next();
}

// ── Email / Nodemailer ────────────────────────────────────
const smtpConfigured =
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

function welcomeEmailHtml(email: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>you're on the list — rive.</title>
</head>
<body style="margin:0;padding:0;background:#F5F8FC;font-family:'Outfit',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F8FC;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:32px;">
          <span style="font-size:28px;font-weight:800;color:#0C1E36;letter-spacing:-0.5px;">rive<span style="color:#1D4ED8;">.</span></span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#ffffff;border-radius:24px;border:1px solid #E2E8F0;overflow:hidden;">

          <!-- Blue top bar -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background:linear-gradient(135deg,#1D4ED8 0%,#3B82F6 100%);padding:40px 40px 36px;text-align:center;">
              <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:3px;text-transform:uppercase;">welcome to rive.</p>
              <h1 style="margin:0;font-size:38px;font-weight:800;color:#ffffff;line-height:1.1;">you're on the list.</h1>
              <p style="margin:16px 0 0;font-size:16px;color:rgba(255,255,255,0.8);line-height:1.5;">we're building something big. you'll be one of the first to know.</p>
            </td></tr>
          </table>

          <!-- Body -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:36px 40px;">

              <p style="margin:0 0 20px;font-size:15px;color:#4A5E78;line-height:1.7;">
                hi there 👋 — thanks for joining the <strong style="color:#0C1E36;">rive.</strong> waitlist. your spot is secured.
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#4A5E78;line-height:1.7;">
                rive. is your all-in-one operating system for freelance work — projects, clients, invoicing, ai workflows, and international payments, all in one place. we're putting the finishing touches on the alpha and you'll be among the first batch of users.
              </p>

              <!-- What's coming -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F8FC;border-radius:16px;margin-bottom:28px;overflow:hidden;">
                <tr><td style="padding:24px 28px;">
                  <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#94A3B8;letter-spacing:2px;text-transform:uppercase;">what's coming in alpha</p>
                  <table cellpadding="0" cellspacing="0">
                    <tr><td style="padding:6px 0;font-size:14px;color:#0C1E36;">✦ &nbsp;gig board — ai-matched freelance projects</td></tr>
                    <tr><td style="padding:6px 0;font-size:14px;color:#0C1E36;">✦ &nbsp;remit payments — send &amp; receive across 47 countries</td></tr>
                    <tr><td style="padding:6px 0;font-size:14px;color:#0C1E36;">✦ &nbsp;ai co-pilot — your intelligent workflow assistant</td></tr>
                    <tr><td style="padding:6px 0;font-size:14px;color:#0C1E36;">✦ &nbsp;client &amp; project management — all in one dashboard</td></tr>
                  </table>
                </td></tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr><td align="center">
                  <a href="https://rive.app" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#1D4ED8,#3B82F6);color:#fff;font-size:14px;font-weight:700;text-decoration:none;border-radius:14px;letter-spacing:0.3px;">visit rive.app →</a>
                </td></tr>
              </table>

              <p style="margin:0;font-size:14px;color:#4A5E78;line-height:1.7;">
                we'll email you when your batch opens. in the meantime, follow us on <a href="#" style="color:#1D4ED8;text-decoration:none;font-weight:600;">twitter</a> and <a href="#" style="color:#1D4ED8;text-decoration:none;font-weight:600;">linkedin</a> for updates.
              </p>
            </td></tr>
          </table>

          <!-- Footer -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:20px 40px 32px;border-top:1px solid #F1F5F9;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">© 2026 rive. · built with ♥ for the freelance generation.</p>
              <p style="margin:0;font-size:12px;color:#CBD5E1;">you're receiving this because ${email} joined the rive. waitlist.</p>
            </td></tr>
          </table>

        </td></tr>
        <!-- End card -->

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendWelcomeEmail(toEmail: string): Promise<void> {
  if (!transporter) {
    console.log(`email: SMTP not configured — skipping welcome email to ${toEmail}`);
    return;
  }
  try {
    await transporter.sendMail({
      from:    `"rive." <${process.env.SMTP_USER}>`,
      to:      toEmail,
      subject: "you're on the list. welcome to rive. 🎉",
      html:    welcomeEmailHtml(toEmail),
    });
    console.log(`email: welcome email sent to ${toEmail}`);
  } catch (err) {
    console.error(`email: failed to send welcome email to ${toEmail}:`, err);
    // Non-fatal — don't throw
  }
}

// ── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json());
initDb();

// ── POST: Track page view ─────────────────────────────────
app.post("/api/track", async (req: Request, res: Response) => {
  try {
    const { path, referrer } = req.body;
    await pool.query(
      "INSERT INTO page_views (path, referrer, user_agent) VALUES ($1, $2, $3);",
      [path || "/", referrer || "", req.headers["user-agent"] || ""]
    );
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

// ── GET: Public waitlist count ────────────────────────────
app.get("/api/waitlist/count", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await pool.query("SELECT COUNT(*)::int AS count FROM waitlist;");
    res.json({ success: true, count: r.rows[0].count });
  } catch (e) { next(e); }
});

// ── POST: Join waitlist ───────────────────────────────────
app.post("/api/waitlist", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = waitlistSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
      return;
    }
    const { email, type } = parsed.data;

    // Duplicate check
    const exists = await pool.query("SELECT id FROM waitlist WHERE email = $1;", [email]);
    if (exists.rows.length > 0) {
      res.status(409).json({ success: false, message: "email address is already registered." });
      return;
    }

    const result = await pool.query(
      "INSERT INTO waitlist (email, type) VALUES ($1, $2) RETURNING id, email, type, status, created_at;",
      [email, type]
    );

    // Fire-and-forget welcome email
    sendWelcomeEmail(email);

    res.status(201).json({
      success: true,
      message: "successfully joined the waitlist.",
      data: result.rows[0],
    });
  } catch (e) { next(e); }
});

// ── POST: Admin login ─────────────────────────────────────
app.post("/api/admin/login", (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    res.json({ success: true, token: issueToken() });
  } else {
    res.status(401).json({ success: false, message: "invalid credentials." });
  }
});

// ── POST: Admin logout ────────────────────────────────────
app.post("/api/admin/logout", (req: Request, res: Response) => {
  const t = req.headers["x-admin-token"] as string;
  if (t) adminTokens.delete(t);
  res.json({ success: true });
});

// ── GET: Admin analytics ──────────────────────────────────
app.get("/api/admin/analytics", requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalSignups, last24h, last7d, remitInterest, approvedCount, totalViews, topPaths, rawSignups, rawViews, typeBreakdown] =
      await Promise.all([
        pool.query("SELECT COUNT(*)::int AS count FROM waitlist;"),
        pool.query("SELECT COUNT(*)::int AS count FROM waitlist WHERE created_at >= NOW() - INTERVAL '24 hours';"),
        pool.query("SELECT COUNT(*)::int AS count FROM waitlist WHERE created_at >= NOW() - INTERVAL '7 days';"),
        pool.query("SELECT COUNT(*)::int AS count FROM waitlist WHERE type = 'remit';"),
        pool.query("SELECT COUNT(*)::int AS count FROM waitlist WHERE status = 'approved';"),
        pool.query("SELECT COUNT(*)::int AS count FROM page_views;"),
        pool.query("SELECT path, COUNT(*)::int AS views FROM page_views GROUP BY path ORDER BY views DESC LIMIT 10;"),
        pool.query("SELECT created_at FROM waitlist WHERE created_at >= NOW() - INTERVAL '14 days' ORDER BY created_at ASC;"),
        pool.query("SELECT visited_at FROM page_views WHERE visited_at >= NOW() - INTERVAL '14 days' ORDER BY visited_at ASC;"),
        pool.query("SELECT type, COUNT(*)::int AS count FROM waitlist GROUP BY type ORDER BY count DESC;"),
      ]);

    // Group signups by day in JS (safe for pg-mem)
    const signupsMap = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      signupsMap.set(key, 0);
    }
    rawSignups.rows.forEach((row: any) => {
      const dateStr = new Date(row.created_at).toISOString().split("T")[0];
      if (signupsMap.has(dateStr)) {
        signupsMap.set(dateStr, (signupsMap.get(dateStr) || 0) + 1);
      }
    });
    const signupsPerDay = Array.from(signupsMap.entries()).map(([day, count]) => ({ day, count }));

    // Group views by day in JS
    const viewsMap = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      viewsMap.set(key, 0);
    }
    rawViews.rows.forEach((row: any) => {
      const dateStr = new Date(row.visited_at).toISOString().split("T")[0];
      if (viewsMap.has(dateStr)) {
        viewsMap.set(dateStr, (viewsMap.get(dateStr) || 0) + 1);
      }
    });
    const viewsPerDay = Array.from(viewsMap.entries()).map(([day, count]) => ({ day, count }));

    res.json({
      success: true,
      data: {
        totalSignups:  totalSignups.rows[0].count,
        last24h:       last24h.rows[0].count,
        last7d:        last7d.rows[0].count,
        remitInterest: remitInterest.rows[0].count,
        approvedCount: approvedCount.rows[0].count,
        totalViews:    totalViews.rows[0].count,
        topPaths:      topPaths.rows,
        signupsPerDay,
        viewsPerDay,
        typeBreakdown: typeBreakdown.rows,
      },
    });
  } catch (e) { next(e); }
});

// ── GET: Admin waitlist — search, sort, filter, paginate ──
const ALLOWED_SORT  = ["email", "type", "status", "created_at", "id"] as const;
const ALLOWED_ORDER = ["ASC", "DESC"] as const;

app.get("/api/admin/waitlist", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || "";
    const status = (req.query.status as string) || "all";
    const type   = (req.query.type   as string) || "all";
    const rawSort  = (req.query.sort  as string) || "created_at";
    const rawOrder = ((req.query.order as string) || "DESC").toUpperCase();

    // Whitelist sort / order to prevent SQL injection
    const sortCol  = ALLOWED_SORT.includes(rawSort  as any) ? rawSort  : "created_at";
    const sortDir  = ALLOWED_ORDER.includes(rawOrder as any) ? rawOrder : "DESC";

    // Build WHERE clauses
    const conditions: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (search) {
      conditions.push(`email ILIKE $${p++}`);
      params.push(`%${search}%`);
    }
    if (status !== "all") {
      conditions.push(`status = $${p++}`);
      params.push(status);
    }
    if (type !== "all") {
      conditions.push(`type = $${p++}`);
      params.push(type);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM waitlist ${where};`, params),
      pool.query(
        `SELECT id, email, type, status, created_at FROM waitlist ${where}
         ORDER BY ${sortCol} ${sortDir}
         LIMIT $${p++} OFFSET $${p++};`,
        [...params, limit, offset]
      ),
    ]);

    res.json({
      success: true,
      data:    dataRes.rows,
      total:   countRes.rows[0].count,
      page,
      limit,
    });
  } catch (e) { next(e); }
});

// ── PATCH: Approve / revoke a waitlist entry ──────────────
app.patch("/api/admin/waitlist/:id", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: "invalid id." });
      return;
    }
    const { status } = req.body;
    if (status !== "approved" && status !== "pending") {
      res.status(400).json({ success: false, message: "status must be 'approved' or 'pending'." });
      return;
    }

    const result = await pool.query(
      "UPDATE waitlist SET status = $1 WHERE id = $2 RETURNING id, email, type, status, created_at;",
      [status, id]
    );

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: "entry not found." });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (e) { next(e); }
});

// ── POST: Save brand assets ───────────────────────────────
app.post("/api/save-logo", (req: Request, res: Response) => {
  try {
    const { filename, dataUrl } = req.body;
    if (!filename || !dataUrl) { res.status(400).json({ success: false, message: "missing params" }); return; }
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const fs   = require("fs");
    const path = require("path");
    const savePath = path.join(__dirname, "../../public/brand-assets", filename);
    fs.writeFileSync(savePath, Buffer.from(base64Data, "base64"));
    res.json({ success: true, path: savePath });
  } catch {
    res.status(500).json({ success: false, message: "failed to save file" });
  }
});

// ── Error handler ─────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("server error:", err);
  res.status(500).json({ success: false, message: "internal server error." });
});

app.listen(PORT, () => console.log(`rive. server → http://localhost:${PORT}`));
