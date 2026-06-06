const nextPublicEnv: Record<string, string | undefined> =
  typeof process !== "undefined"
    ? {
        NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
        NEXT_PUBLIC_ENABLE_PROTECTED_DELIVERY: process.env.NEXT_PUBLIC_ENABLE_PROTECTED_DELIVERY,
        NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
        NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
          process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      }
    : {};

function readPublicEnv(nextKey: string) {
  return nextPublicEnv[nextKey];
}

export function getPublicApiBaseUrl() {
  return (readPublicEnv("NEXT_PUBLIC_API_BASE_URL") ?? "").trim().replace(/\/$/, "");
}

export function isProtectedDeliveryEnabled() {
  return readPublicEnv("NEXT_PUBLIC_ENABLE_PROTECTED_DELIVERY") === "true";
}

export function getGoogleMapsBrowserKey() {
  return readPublicEnv("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY");
}

export function getRazorpayKeyId() {
  return readPublicEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID");
}

export function getFirebaseClientConfig() {
  return {
    apiKey:
      readPublicEnv("NEXT_PUBLIC_FIREBASE_API_KEY") ?? "AIzaSyBig88ltbM-GVXbEidCeQlnDl_Vc3pvAYI",
    authDomain:
      readPublicEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN") ?? "bookverse-a0024.firebaseapp.com",
    projectId: readPublicEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID") ?? "bookverse-a0024",
    storageBucket:
      readPublicEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET") ??
      "bookverse-a0024.firebasestorage.app",
    messagingSenderId:
      readPublicEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID") ?? "516406961987",
    appId:
      readPublicEnv("NEXT_PUBLIC_FIREBASE_APP_ID") ??
      "1:516406961987:web:6b9b0d97dd6eb5836c71f6",
  };
}
