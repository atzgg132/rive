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
}
