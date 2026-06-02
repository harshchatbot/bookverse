/* global process, console */
/*
 * ONE-TIME CLEANUP: remove legacy seller PII fields from existing books docs.
 *
 * Dry-run by default:
 *   npm run cleanup:books-pii
 *
 * Apply changes:
 *   npm run cleanup:books-pii -- --apply
 *
 * Requires Firebase Admin credentials via either:
 * - FIREBASE_SERVICE_ACCOUNT_JSON containing the full service account JSON, or
 * - GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON file.
 */
import { readFileSync } from "node:fs";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const COLLECTION = "books";
const PII_FIELDS = [
  "sellerMobile",
  "sellerEmail",
  "mobile",
  "email",
  "address",
  "sellerAddress",
  "pincode",
  "fullAddress",
];
const BATCH_LIMIT = 450;
const DEFAULT_PROJECT_ID = "bookverse-a0024";
const apply = process.argv.includes("--apply");

function projectId() {
  return (
    process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT_ID
  );
}

function credentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    const parsed = JSON.parse(raw);
    return cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    });
  }

  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    });
  }

  return applicationDefault();
}

function initFirebase() {
  if (getApps().length) return;
  const id = projectId();
  console.log(`[cleanup:books-pii] projectId=${id}`);
  initializeApp({ credential: credentials(), projectId: id });
}

function piiFieldsPresent(data) {
  return PII_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(data, field));
}

async function main() {
  initFirebase();
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTION).get();

  let scanned = 0;
  let updated = 0;
  let batch = db.batch();
  let batchWrites = 0;

  for (const doc of snapshot.docs) {
    scanned += 1;
    const present = piiFieldsPresent(doc.data());
    if (present.length === 0) continue;

    updated += 1;
    console.log(`[cleanup:books-pii] ${doc.id}: removing ${present.join(", ")}`);

    if (!apply) continue;

    const patch = Object.fromEntries(present.map((field) => [field, FieldValue.delete()]));
    batch.update(doc.ref, patch);
    batchWrites += 1;

    if (batchWrites >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      batchWrites = 0;
    }
  }

  if (apply && batchWrites > 0) {
    await batch.commit();
  }

  console.log(`[cleanup:books-pii] mode=${apply ? "apply" : "dry-run"}`);
  console.log(`[cleanup:books-pii] documents scanned=${scanned}`);
  console.log(
    `[cleanup:books-pii] documents ${apply ? "updated" : "that would be updated"}=${updated}`,
  );

  if (!apply) {
    console.log("[cleanup:books-pii] dry-run only; rerun with -- --apply to write changes.");
  }
}

main().catch((error) => {
  console.error("[cleanup:books-pii] failed", error);
  process.exitCode = 1;
});
