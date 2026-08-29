/**
 * Loader for `npm run analytics:diagnose`.
 * Maps `@/` to `src/`, stubs `server-only`, and does not mock Prisma.
 */
import { register } from "node:module";

register(new URL("./diagnose-hook.mjs", import.meta.url), {
  parentURL: import.meta.url,
});
