import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBig88ltbM-GVXbEidCeQlnDl_Vc3pvAYI",
  authDomain: "bookverse-a0024.firebaseapp.com",
  projectId: "bookverse-a0024",
  storageBucket: "bookverse-a0024.firebasestorage.app",
  messagingSenderId: "516406961987",
  appId: "1:516406961987:web:6b9b0d97dd6eb5836c71f6",
  measurementId: "G-TK5YHNHJGC",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

export const ADMIN_EMAILS = ["harshveernirwan@gmail.com"];
