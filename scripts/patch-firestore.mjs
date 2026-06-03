import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { resolve, join } from "path";

function patchJson(filePath) {
  const fullPath = resolve(filePath);
  if (!existsSync(fullPath)) {
    console.log(`[patch] skipping (not found): ${filePath}`);
    return;
  }
  const content = readFileSync(fullPath, "utf-8");
  try {
    JSON.parse(content);
  } catch {
    console.log(`[patch] skipping (invalid JSON): ${filePath}`);
    return;
  }
  // Add type: commonjs to package.json files to prevent ESM JSON import issues
  const parsed = JSON.parse(content);
  if (parsed.type === "module") {
    parsed.type = "commonjs";
    writeFileSync(fullPath, JSON.stringify(parsed, null, 2));
    console.log(`[patch] set type:commonjs in ${filePath}`);
  }
}

// Patch google-auth-library package.json
patchJson("node_modules/google-auth-library/package.json");
patchJson("node_modules/@google-cloud/firestore/package.json");
patchJson("node_modules/google-gax/package.json");
patchJson("node_modules/gaxios/package.json");
patchJson("node_modules/gcp-metadata/package.json");
