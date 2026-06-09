import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(readFileSync("./service-account.json", "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection("orders").orderBy("createdAt", "desc").limit(1).get();
snap.docs.forEach(doc => {
  const d = doc.data();
  console.log(JSON.stringify({
    id: doc.id,
    status: d.status,
    shipmentStatus: d.shipmentStatus,
    shiprocketOrderId: d.shiprocketOrderId,
    pickupAddress: d.pickupAddress ? "EXISTS" : "MISSING",
    buyerDeliveryAddress: d.buyerDeliveryAddress ? "EXISTS" : "MISSING",
    fulfillmentError: d.fulfillmentError,
  }, null, 2));
});
