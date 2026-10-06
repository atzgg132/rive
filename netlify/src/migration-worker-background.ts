import { parseMigrationWorkMessage } from "@/utils/migration/queue";
import { processMigrationWork } from "@/utils/migration/worker";

type Event = { httpMethod: string; headers: Record<string, string | undefined>; body: string | null };

export async function handler(event: Event) {
  if (event.httpMethod !== "POST" || !process.env.CRON_SECRET || event.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return { statusCode: 401, body: "Unauthorized" };
  }
  let message;
  try {
    message = parseMigrationWorkMessage(JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, body: "Invalid message" };
  }
  if (!message) return { statusCode: 400, body: "Invalid message" };
  const result = await processMigrationWork(message);
  if (!result.accepted) throw new Error("Migration environment mismatch.");
  console.info(JSON.stringify({ event: "migration_worker_completed", migrationId: message.migrationId, status: result.status }));
  return { statusCode: 200, body: "Processed" };
}
