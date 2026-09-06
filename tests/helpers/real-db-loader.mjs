/**
 * Loader entrypoint for real-persistence route tests (W04).
 *
 * Registers the alias-only resolution hook (no `@/utils/db` mock) so the
 * server modules under test use the real Prisma client.
 *
 * Usage:
 *   DATABASE_URL=postgresql://arnav_bhattacharya@127.0.0.1:5434/rive_w04?sslmode=disable `
 *   DATABASE_SSL=disable EMAIL_PROVIDER=console SESSION_SECRET=w04-test-secret `
 *   node --experimental-strip-types --import ./tests/helpers/real-db-loader.mjs `
 *        --test tests/persistence/w04-*.test.mjs
 */

import { register } from "node:module";

register(new URL("./alias-only-hook.mjs", import.meta.url), {
  parentURL: import.meta.url,
});
