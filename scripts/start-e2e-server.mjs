import { cp } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const standaloneRoot = join(root, ".next", "standalone");

// Next's standalone server expects the static and public assets beside the
// traced server bundle. The Dockerfile performs this copy while assembling
// the runtime image; the CI browser job needs the same layout locally.
await cp(join(root, "public"), join(standaloneRoot, "public"), { recursive: true, force: true });
await cp(join(root, ".next", "static"), join(standaloneRoot, ".next", "static"), { recursive: true, force: true });

const server = spawn(process.execPath, [join(standaloneRoot, "server.js")], {
  cwd: standaloneRoot,
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.kill(signal));
}

server.once("error", (error) => {
  console.error("Could not start the standalone E2E server.", error);
  process.exit(1);
});

server.once("exit", (code) => process.exit(code ?? 1));
