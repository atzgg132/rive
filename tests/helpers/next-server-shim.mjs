/**
 * Re-exports the REAL Next.js transport classes (`next/server` dist build)
 * for real-persistence route tests. Plain `node --test` cannot resolve the
 * `next/server` entry point, but the underlying classes are ordinary
 * `Request`/`Response` subclasses that load fine outside the Next runtime.
 * Route handler code, validation, Prisma access, and session auth all run
 * exactly as in production; only the HTTP socket is absent.
 */
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "node_modules",
  "next",
  "dist",
  "server",
  "web",
  "spec-extension",
);

const require = createRequire(import.meta.url);
const { NextRequest } = require(join(dist, "request.js"));
const { NextResponse } = require(join(dist, "response.js"));

export { NextRequest, NextResponse };
