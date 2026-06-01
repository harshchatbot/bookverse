// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isVercel = !!process.env.VERCEL;

// Firebase Admin / Google Cloud Firestore are Node packages. Let Nitro's own
// traceDeps externalizer handle them so Vercel receives the matching node_modules
// files; using Rollup's raw external hook skips tracing and causes module-not-found
// errors such as missing @grpc/grpc-js at runtime.
const tracedNodePackages = [
  "firebase-admin*",
  "@google-cloud/firestore*",
  "google-gax*",
  "@grpc/grpc-js*",
  "@grpc/proto-loader*",
  "google-auth-library*",
  "gcp-metadata*",
  "protobufjs*",
  "long*",
];

const vercelNitro = {
  preset: "vercel",
  node: true,
  noExternals: false,
  traceDeps: tracedNodePackages,
  output: {
    dir: ".vercel/output",
    serverDir: ".vercel/output/functions/__server.func",
    publicDir: ".vercel/output/static",
  },
};

const config = {
  tanstackStart: {
    server: { entry: "server" },
  },
  ...(isVercel ? { nitro: vercelNitro } : {}),
};

// Cast: the wrapper's Nitro type omits some Nitro options used by Vercel builds.
export default defineConfig(config as Parameters<typeof defineConfig>[0]);

