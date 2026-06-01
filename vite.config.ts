// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isVercel = !!process.env.VERCEL;

// firebase-admin and the Google gRPC stack are Node CJS packages that use
// __dirname/require at runtime. When Nitro rewrites them to ESM they crash
// with "__dirname is not defined in ES module scope". Keep them external so
// Vercel's Node runtime require()s them as CJS.
const nodeOnlyExternals = [
  "firebase-admin",
  "firebase-admin/app",
  "firebase-admin/auth",
  "firebase-admin/firestore",
  "@google-cloud/firestore",
  "@grpc/grpc-js",
  "@grpc/proto-loader",
  "google-gax",
  "google-auth-library",
  "gcp-metadata",
  "protobufjs",
  "long",
];

function isNodeOnlyExternal(id: string) {
  return nodeOnlyExternals.some((pkg) => id === pkg || id.startsWith(`${pkg}/`));
}

const vercelNitro = {
  preset: "vercel",
  node: true,
  noExternals: false,
  traceDeps: nodeOnlyExternals,
  output: {
    dir: ".vercel/output",
    serverDir: ".vercel/output/functions/__server.func",
    publicDir: ".vercel/output/static",
  },
  rollupConfig: {
    external: isNodeOnlyExternal,
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

