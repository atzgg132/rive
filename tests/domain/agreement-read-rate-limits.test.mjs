import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const ROUTE_FILES = [
  "src/app/api/public/contracts/review/[token]/route.ts",
  "src/app/api/public/contracts/sign/[token]/route.ts",
  "src/app/api/public/contracts/artifact/[token]/route.ts",
];

function getExportBody(source, name) {
  const marker = `export async function ${name}`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `missing ${name} in route`);
  const next = source.indexOf("export async function ", start + marker.length);
  return next >= 0 ? source.slice(start, next) : source.slice(start);
}

test("public agreement GET handlers call durableRateLimit before serving", async () => {
  for (const relative of ROUTE_FILES) {
    const source = await readFile(join(root, relative), "utf8");
    const getBody = getExportBody(source, "GET");
    assert.match(
      getBody,
      /durableRateLimit\s*\(/,
      `${relative} GET must call durableRateLimit`,
    );
  }
});
