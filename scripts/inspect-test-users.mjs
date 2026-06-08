import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldPath } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(readFileSync("./service-account.json", "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Check if order UIDs belong to test users
const testUids = [
  "dNZNayMwlcW7rkSl18KNGp4YlxF3",
  "NOYS14U4sOW8a4m9afcg7smqaLJ3",
  "Vjju9GCDm6NAlWA2OCSaiIiGrWv2",
];

const auth = getAuth();
for (const uid of testUids) {
  try {
    const user = await auth.getUser(uid);
    console.log(uid, user.email);
  } catch {
    console.log(uid, "NOT FOUND");
  }
}
