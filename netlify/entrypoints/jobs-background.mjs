import { handler } from "../src/jobs-background.ts";

export const config = { background: true };

export default async function jobs(request) {
  const result = await handler({
    httpMethod: request.method,
    headers: Object.fromEntries(request.headers),
    body: await request.text(),
  });
  return new Response(result.body, { status: result.statusCode });
}
