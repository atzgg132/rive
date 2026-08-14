/**
 * Resolution hook backing module-loader.mjs.
 *
 * `server-only` is stubbed to an empty module; `@/` path aliases are rewritten
 * to `<root>/src/`; and extension-less imports are resolved to their `.ts` /
 * `.mjs` siblings the way tsconfig `moduleResolution: "bundler"` does. This is
 * what lets the no-DB domain tests import server-bound modules like
 * `src/utils/migration/commit.ts` under `node --test`.
 */

const stubUrl = "server-only:stub";

import { join, dirname, extname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

/** Repo root: this hook lives at <root>/tests/helpers/. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The mock module substituted for @/utils/db so tests can drive commit. */
const mockDbUrl = pathToFileURL(join(root, "tests", "helpers", "prisma-mock.mjs")).href;

const CANDIDATE_EXTENSIONS = [".ts", ".tsx", ".mjs", ".js", ".mts", ".json"];

/** Resolve a path to an existing file, trying candidate extensions. */
function resolveWithExtensions(absPath) {
  if (existsSync(absPath)) return absPath;
  if (extname(absPath)) return null;
  for (const ext of CANDIDATE_EXTENSIONS) {
    if (existsSync(`${absPath}${ext}`)) return `${absPath}${ext}`;
  }
  return null;
}

export function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: stubUrl, shortCircuit: true };
  }

  // Substitute the mock db module for the real one so no pg Pool is created.
  if (specifier === "@/utils/db" || specifier === "@/utils/db.ts") {
    return { url: mockDbUrl, shortCircuit: true };
  }

  // Absolute or relative path? Let the default resolver handle it.
  if (specifier.startsWith("@/")) {
    const base = join(root, "src", specifier.slice(2));
    const resolved = resolveWithExtensions(base);
    if (resolved) return nextResolve(pathToFileURL(resolved).href, context);
  }

  return nextResolve(specifier, context);
}

export function load(url, context, nextLoad) {
  if (url === stubUrl) {
    return { format: "module", source: "", shortCircuit: true };
  }
  return nextLoad(url, context);
}
