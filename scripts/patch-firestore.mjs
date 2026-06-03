import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const targets = [
  "node_modules/@google-cloud/firestore/build/src/v1/firestore_client_config.json",
  "node_modules/google-auth-library/package.json",
];

for (const target of targets) {
  const fullPath = resolve(target);
  if (!existsSync(fullPath)) continue;
  const content = readFileSync(fullPath, "utf-8");
  const jsPath = fullPath.replace(".json", ".js");
  if (!existsSync(jsPath)) {
    writeFileSync(jsPath, `export default ${content};\n`);
    console.log(`[patch] wrote ${jsPath}`);
  }
}
