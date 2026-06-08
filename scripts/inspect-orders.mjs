import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(readFileSync("./service-account.json", "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection("orders").limit(5).get();
snap.docs.forEach(doc => {
  const d = doc.data();
  console.log(JSON.stringify({
    id: doc.id,
    sellerUid: d.sellerUid,
    buyerUid: d.buyerUid,
    sellerName: d.sellerName,
    status: d.status,
    createdAt: d.createdAt,
  }, null, 2));
});
