import type { User } from "firebase/auth";
import { updateProfile } from "firebase/auth";
import { deleteField, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";

export const ADMIN_EMAIL = "harshveernirwan@gmail.com";
const USERS_COLLECTION = "users";
const PROFILES_COLLECTION = "profiles";

export type UserRole = "buyer" | "seller" | "admin";

export interface BookVerseUserProfile {
  uid: string;
  name: string;
  email: string;
  emailVerified: boolean;
  mobile: string;
  whatsappNumber: string;
  phoneVerified: boolean;
  state: string;
  city: string;
  address: string;
  pincode: string;
  role: UserRole;
  createdAt: string | null;
  updatedAt: string | null;
}

export type EditableUserProfile = Pick<
  BookVerseUserProfile,
  "name" | "mobile" | "whatsappNumber" | "state" | "city" | "address" | "pincode"
>;

const EMPTY_PROFILE: BookVerseUserProfile = {
  uid: "",
  name: "",
  email: "",
  emailVerified: false,
  mobile: "",
  whatsappNumber: "",
  phoneVerified: false,
  state: "",
  city: "",
  address: "",
  pincode: "",
  role: "buyer",
  createdAt: null,
  updatedAt: null,
};

export function roleForEmail(email: string | null | undefined): UserRole {
  return email?.toLowerCase() === ADMIN_EMAIL ? "admin" : "buyer";
}

export function normalizeIndianMobile(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits.slice(-10);
}

export function isProfileCompleted(profile: BookVerseUserProfile | null | undefined): boolean {
  if (!profile) return false;
  return !!(
    profile.name.trim() &&
    normalizeIndianMobile(profile.mobile).length === 10 &&
    profile.state.trim() &&
    profile.city.trim() &&
    /^\d{6}$/.test(profile.pincode)
  );
}

export async function getUserProfile(uid: string): Promise<BookVerseUserProfile | null> {
  const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<BookVerseUserProfile>;
  return {
    ...EMPTY_PROFILE,
    ...data,
    uid,
    role: data.role === "admin" ? "admin" : data.role === "seller" ? "seller" : "buyer",
    createdAt: typeof data.createdAt === "string" ? data.createdAt : null,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
  };
}

export async function ensureUserProfile(user: User): Promise<void> {
  const ref = doc(db, USERS_COLLECTION, user.uid);
  const existing = await getDoc(ref);
  const base = {
    uid: user.uid,
    name: user.displayName ?? "",
    email: user.email ?? "",
    emailVerified: user.emailVerified,
    role: roleForEmail(user.email),
    updatedAt: serverTimestamp(),
  };

  if (existing.exists()) {
    await setDoc(ref, base, { merge: true });
    return;
  }

  await setDoc(ref, {
    ...base,
    mobile: "",
    whatsappNumber: "",
    phoneVerified: false,
    state: "",
    city: "",
    address: "",
    pincode: "",
    createdAt: serverTimestamp(),
  });
}

export async function saveUserProfile(
  user: User,
  input: EditableUserProfile & { phoneVerified?: boolean },
): Promise<void> {
  const mobile = normalizeIndianMobile(input.mobile);
  const whatsappNumber = normalizeIndianMobile(input.whatsappNumber || input.mobile);
  const payload = {
    uid: user.uid,
    name: input.name.trim(),
    email: user.email ?? "",
    emailVerified: user.emailVerified,
    mobile,
    whatsappNumber,
    phoneVerified: !!input.phoneVerified,
    state: input.state.trim(),
    city: input.city.trim(),
    address: input.address.trim(),
    pincode: input.pincode.replace(/\D/g, "").slice(0, 6),
    role: roleForEmail(user.email),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, USERS_COLLECTION, user.uid), payload, { merge: true });

  await setDoc(
    doc(db, PROFILES_COLLECTION, user.uid),
    {
      displayName: payload.name,
      city: payload.city,
      mobile: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  if (auth.currentUser?.uid === user.uid && auth.currentUser.displayName !== payload.name) {
    await updateProfile(auth.currentUser, { displayName: payload.name || null });
  }
}

export async function setUserPhoneVerified(user: User, verified: boolean): Promise<void> {
  await setDoc(
    doc(db, USERS_COLLECTION, user.uid),
    {
      uid: user.uid,
      email: user.email ?? "",
      emailVerified: user.emailVerified,
      phoneVerified: verified,
      role: roleForEmail(user.email),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function syncUserEmailVerification(user: User): Promise<boolean> {
  await user.reload();
  const refreshed = auth.currentUser ?? user;
  await ensureUserProfile(refreshed);
  return refreshed.emailVerified;
}
