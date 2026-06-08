import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(readFileSync("./service-account.json", "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function cleanup() {
  const collections = ["orders", "seller_payouts"];
  for (const col of collections) {
    const snap = await db.collection(col).get();
    console.log(`Deleting ${snap.docs.length} docs from ${col}...`);
    for (const doc of snap.docs) await doc.ref.delete();
    console.log(`Done: ${col}`);
  }
}
cleanup().catch(console.error);
