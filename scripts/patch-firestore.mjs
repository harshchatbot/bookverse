import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const target = resolve(
  "node_modules/@google-cloud/firestore/build/src/v1/firestore_client_config.json",
);

if (existsSync(target)) {
  const content = readFileSync(target, "utf-8");
  const jsPath = target.replace(".json", ".js");
  if (!existsSync(jsPath)) {
    writeFileSync(jsPath, `export default ${content};\n`);
    console.log("[patch-firestore] wrote firestore_client_config.js");
  }
}
