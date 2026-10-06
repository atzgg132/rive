import { handler } from "../src/migration-worker-background.ts";

export const config = { background: true };

export default async function migration(request) {
  const result = await handler({
    httpMethod: request.method,
    headers: Object.fromEntries(request.headers),
    body: await request.text(),
  });
  return new Response(result.body, { status: result.statusCode });
}
