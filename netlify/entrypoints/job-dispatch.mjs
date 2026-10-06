import { handler } from "../src/job-dispatch.ts";

export default async function dispatch() {
  const result = await handler();
  return new Response(result.body, { status: result.statusCode });
}
