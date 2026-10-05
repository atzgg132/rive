import { build } from "esbuild";

await build({
  entryPoints: ["netlify/src/job-dispatch.ts", "netlify/src/jobs-background.ts", "netlify/src/migration-worker-background.ts"],
  outdir: "netlify/functions",
  outExtension: { ".js": ".cjs" },
  platform: "node",
  target: "node22",
  format: "cjs",
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
