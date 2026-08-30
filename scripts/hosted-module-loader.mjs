/**
 * Runtime loader for hosted operational scripts.
 *
 * Unlike the domain-test loader, this resolves `@/` imports to the real source
 * tree and never substitutes the database. That distinction is essential for
 * a smoke test whose purpose is to validate the hosted PostgreSQL instance.
 */

import { register } from "node:module";

register(new URL("./hosted-resolution-hook.mjs", import.meta.url), {
  parentURL: import.meta.url,
});
