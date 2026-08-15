const requiredProductionVariables = [
  "DATABASE_URL",
  "APP_URL",
  "APP_ENV",
  "SESSION_SECRET",
  "CALENDAR_ENCRYPTION_KEY",
  "CRON_SECRET",
] as const;

export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) return;

  const missing = requiredProductionVariables.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }

  if (process.env.SESSION_SECRET === process.env.CRON_SECRET) {
    throw new Error("SESSION_SECRET and CRON_SECRET must be different.");
  }

  // Older non-production hosts may not have the EMAIL_PROVIDER parameter yet.
  // They already have an instance role with SES permissions, so use SES as the
  // safe forward-compatible default while keeping production explicit.
  const appEnvironment = (process.env.APP_ENV || "").toLowerCase();
  const nonProductionEnvironment = ["dev", "test", "development", "staging"].includes(appEnvironment);
  const configuredEmailProvider = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  const emailProvider = (
    nonProductionEnvironment && ["", "disabled"].includes(configuredEmailProvider)
      ? "ses"
      : configuredEmailProvider
  ).toLowerCase();
  if (!["smtp", "zoho", "ses"].includes(emailProvider)) {
    throw new Error("EMAIL_PROVIDER must be configured as smtp, zoho, or ses in production.");
  }
  const missingEmailVariables = emailProvider === "ses"
    ? ["AWS_REGION"].filter((name) => !process.env[name])
    : ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].filter((name) => !process.env[name]);
  if (missingEmailVariables.length > 0) {
    throw new Error(`Missing transactional email environment variables: ${missingEmailVariables.join(", ")}`);
  }
}
