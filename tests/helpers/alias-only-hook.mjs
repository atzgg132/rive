/**
 * Resolution hook for real-persistence route tests (W04).
 *
 * Same `@/` alias, extension, and `server-only` handling as
 * `resolution-hook.mjs`, but WITHOUT the `@/utils/db` mock substitution so
 * the real Prisma client talks to the isolated Postgres database.
 */

const stubUrl = "server-only:stub";

import { join, dirname, extname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

/** Repo root: this hook lives at <root>/tests/helpers/. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Real Next.js transport classes (see next-server-shim.mjs). */
const nextServerUrl = pathToFileURL(join(root, "tests", "helpers", "next-server-shim.mjs")).href;

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

  if (specifier === "next/server") {
    return { url: nextServerUrl, shortCircuit: true };
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
