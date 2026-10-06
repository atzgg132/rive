import { build } from "esbuild";
import { rm } from "node:fs/promises";

await rm("netlify/functions", { recursive: true, force: true });

await build({
  entryPoints: ["netlify/entrypoints/job-dispatch.mjs", "netlify/entrypoints/jobs-background.mjs", "netlify/entrypoints/migration-worker-background.mjs"],
  outdir: "netlify/functions",
  outExtension: { ".js": ".mjs" },
  platform: "node",
  target: "node22",
  format: "esm",
  bundle: true,
  packages: "external",
  tsconfig: "tsconfig.json",
  plugins: [{
    name: "server-only-function-boundary",
    setup(builder) {
      // These entrypoints are exclusively server-side, like Next's server
      // bundles. Keep the browser guard in all application/client builds.
      builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "server-boundary" }));
      builder.onLoad({ filter: /.*/, namespace: "server-boundary" }, () => ({ contents: "", loader: "js" }));
    },
  }],
});
