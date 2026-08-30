import { existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const serverOnlyStub = "server-only:hosted-script-stub";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const candidateExtensions = [".ts", ".tsx", ".mjs", ".js", ".mts", ".json"];

function resolveWithExtensions(absolutePath) {
  if (existsSync(absolutePath)) return absolutePath;
  if (extname(absolutePath)) return null;
  for (const extension of candidateExtensions) {
    if (existsSync(`${absolutePath}${extension}`)) return `${absolutePath}${extension}`;
  }
  return null;
}

export function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: serverOnlyStub, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const resolved = resolveWithExtensions(join(root, "src", specifier.slice(2)));
    if (resolved) return nextResolve(pathToFileURL(resolved).href, context);
  }
  return nextResolve(specifier, context);
}

export function load(url, context, nextLoad) {
  if (url === serverOnlyStub) {
    return { format: "module", source: "", shortCircuit: true };
  }
  return nextLoad(url, context);
}
