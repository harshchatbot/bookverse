import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(readFileSync("./service-account.json", "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function cleanup() {
  // Delete test orders (created by E2E tests - they have test listing IDs)
  const ordersSnap = await db.collection("orders").get();
  console.log(`Found ${ordersSnap.docs.length} orders`);
  
  let deleted = 0;
  for (const doc of ordersSnap.docs) {
    const data = doc.data();
    // E2E orders have sellerName "E2E Seller" or test UIDs
    if (
      data.sellerName === "E2E Seller" ||
      data.sellerUid?.startsWith("e2e_test_") ||
      data.buyerUid?.startsWith("e2e_test_")
    ) {
      await doc.ref.delete();
      deleted++;
    }
  }
  console.log(`Deleted ${deleted} test orders`);

  // Delete test seller_payouts
  const payoutsSnap = await db.collection("seller_payouts").get();
  console.log(`Found ${payoutsSnap.docs.length} payouts`);
  let deletedPayouts = 0;
  for (const doc of payoutsSnap.docs) {
    const data = doc.data();
    if (
      data.sellerName === "E2E Seller" ||
      data.sellerUid?.startsWith("e2e_test_") ||
      data.buyerUid?.startsWith("e2e_test_")
    ) {
      await doc.ref.delete();
      deletedPayouts++;
    }
  }
  console.log(`Deleted ${deletedPayouts} test payouts`);
}

cleanup().catch(console.error);
