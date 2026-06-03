import { existsSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, join } from "path";

function patchDir(dir) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      patchDir(join(dir, entry.name));
    } else if (entry.name === "package.json") {
      const full = join(dir, entry.name);
      try {
        const pkg = JSON.parse(readFileSync(full, "utf-8"));
        if (pkg.type === "module") {
          pkg.type = "commonjs";
          writeFileSync(full, JSON.stringify(pkg, null, 2));
          console.log(`[patch-nf3] ${full} → commonjs`);
        }
      } catch {}
    }
  }
}

// Patch Nitro's .nf3 traced dependency folder
patchDir(resolve("node_modules/.nf3"));
patchDir(resolve(".vercel/output/functions/__server.func/node_modules"));
