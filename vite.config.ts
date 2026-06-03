import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const isVercel = !!process.env.VERCEL;

function patchPackageJsonType(pkgPath: string) {
  const full = resolve(pkgPath);
  if (!existsSync(full)) return;
  try {
    const pkg = JSON.parse(readFileSync(full, "utf-8"));
    if (pkg.type === "module") {
      pkg.type = "commonjs";
      writeFileSync(full, JSON.stringify(pkg, null, 2));
      console.log(`[patch] ${pkgPath} → type:commonjs`);
    }
  } catch {}
}

// Patch at import time (before Nitro reads node_modules)
patchPackageJsonType("node_modules/google-auth-library/package.json");
patchPackageJsonType("node_modules/@google-cloud/firestore/package.json");
patchPackageJsonType("node_modules/google-gax/package.json");
patchPackageJsonType("node_modules/gaxios/package.json");
patchPackageJsonType("node_modules/gcp-metadata/package.json");

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
  "@js-sdsl/ordered-map*",
  "@js-sdsl/*",
  "gaxios*",
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

export default defineConfig(config as Parameters<typeof defineConfig>[0]);
