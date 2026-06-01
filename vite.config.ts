// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// When building on Vercel, force Nitro on with the `vercel` preset so the
// output uses Vercel's Build Output API (.vercel/output). Locally and in the
// Lovable sandbox we leave `nitro` undefined so the wrapper's auto-detection
// keeps Cloudflare-based preview/publish working exactly as before.
const isVercel = !!process.env.VERCEL;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  ...(isVercel
    ? {
        nitro: {
          preset: "vercel",
          // The Lovable wrapper hard-codes output.{dir,serverDir,publicDir}
          // to "dist/..." which suppresses Nitro's vercel preset defaults
          // and leaves Vercel with no Build Output API tree to serve (404).
          // Restore all three paths the `vercel` preset expects.
          output: {
            dir: ".vercel/output",
            // The function directory name becomes the route destination in
            // config.json. Nitro's vercel preset routes to `/__server`, so
            // the function MUST be emitted as `__server.func` — not
            // `__nitro.func` — or every request 404s.
            serverDir: ".vercel/output/functions/__server.func",
            publicDir: ".vercel/output/static",
          },
        },
      }
    : {}),
});
