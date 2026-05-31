import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { auth, db, storage } from "@/integrations/firebase/client";

const COLLECTION = "profiles";

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
  city: string;
  mobile: string;
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return null;
  const d = snap.data() as Partial<UserProfile>;
  return {
    uid,
    displayName: d.displayName ?? "",
    photoURL: d.photoURL ?? "",
    bio: d.bio ?? "",
    city: d.city ?? "",
    mobile: d.mobile ?? "",
  };
}

export async function saveProfile(uid: string, input: Omit<UserProfile, "uid">): Promise<void> {
  await setDoc(
    doc(db, COLLECTION, uid),
    { ...input, updatedAt: serverTimestamp() },
    { merge: true },
  );
  
  if (auth.currentUser && auth.currentUser.uid === uid) {
    await updateProfile(auth.currentUser, {
      displayName: input.displayName || null,
      photoURL: input.photoURL || null,
    });
  }
}

export async function uploadAvatar(uid: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `avatars/${uid}/avatar-${Date.now()}.${ext}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type });
  return getDownloadURL(r);
}
