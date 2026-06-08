import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(readFileSync("./service-account.json", "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();

async function cleanup() {
  // Delete test users from users collection (email contains e2e_test_)
  const snap = await db.collection("users").get();
  console.log(`Found ${snap.docs.length} users`);
  
  let deleted = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const email = data.email || "";
    if (email.includes("e2e_test_") || email.includes("@test.local")) {
      await doc.ref.delete();
      // Also delete from profiles
      await db.collection("profiles").doc(doc.id).delete().catch(() => {});
      deleted++;
    }
  }
  console.log(`Deleted ${deleted} test users from Firestore`);

  // Delete test offers
  const offersSnap = await db.collection("offers").get();
  let deletedOffers = 0;
  for (const doc of offersSnap.docs) {
    const data = doc.data();
    if (data.buyerEmail?.includes("@test.local") || data.buyerEmail?.includes("e2e_test_")) {
      await doc.ref.delete();
      deletedOffers++;
    }
  }
  console.log(`Deleted ${deletedOffers} test offers`);
}

cleanup().catch(console.error);
