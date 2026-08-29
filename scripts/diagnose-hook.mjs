import { join, dirname, extname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const stubUrl = "server-only:stub";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CANDIDATE_EXTENSIONS = [".ts", ".tsx", ".mjs", ".js", ".mts", ".json"];

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
