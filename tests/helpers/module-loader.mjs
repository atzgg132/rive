/**
 * Loader entrypoint for the no-DB domain tests that drive server-bound modules.
 *
 * Registers the resolution hook (server-only stub, @/ alias, extension-less
 * imports, and the @/utils/db → in-memory mock substitution) and re-exports
 * the shared mock so the test and the server module under test operate on the
 * same in-memory database.
 *
 * Usage (matches `test:domain` in package.json):
 *   node --experimental-strip-types --import ./tests/helpers/module-loader.mjs \
 *        --test tests/domain/migration-crash-resume.test.mjs
 */

import { register } from "node:module";

register(new URL("./resolution-hook.mjs", import.meta.url), {
  parentURL: import.meta.url,
});

export { prisma, Prisma, createPrismaMock } from "./prisma-mock.mjs";
