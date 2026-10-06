export async function handler() {
  if (process.env.NETLIFY_SCHEDULES_ENABLED !== "true") return { statusCode: 200, body: "Disabled" };
  const baseUrl = process.env.NETLIFY_SITE_URL;
  const secret = process.env.CRON_SECRET;
  if (!baseUrl || !secret) throw new Error("Job dispatcher is not configured.");
  const url = new URL("/.netlify/functions/jobs-background", baseUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".netlify.app")) throw new Error("Invalid Netlify origin.");
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ scheduledAt: new Date().toISOString() }),
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status !== 202) throw new Error("Netlify did not accept scheduled jobs.");
  return { statusCode: 200, body: "Dispatched" };
}
