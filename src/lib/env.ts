const nextPublicEnv: Record<string, string | undefined> =
  typeof process !== "undefined"
    ? {
        NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
        NEXT_PUBLIC_ENABLE_PROTECTED_DELIVERY: process.env.NEXT_PUBLIC_ENABLE_PROTECTED_DELIVERY,
        NEXT_PUBLIC_RAZORPAY_MODE: process.env.NEXT_PUBLIC_RAZORPAY_MODE,
        NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
        NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        NEXT_PUBLIC_RAZORPAY_TEST_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_TEST_KEY_ID,
        NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
          process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      }
    : {};

const viteEnv =
  typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env as Record<string, string | undefined>)
    : undefined;

function readPublicEnv(nextKey: string, viteKey?: string) {
  const nextValue = nextPublicEnv[nextKey];
  if (nextValue !== undefined) return nextValue;
  return viteKey ? viteEnv?.[viteKey] : undefined;
}

export function getPublicApiBaseUrl() {
  return (readPublicEnv("NEXT_PUBLIC_API_BASE_URL", "VITE_API_BASE_URL") ?? "")
    .trim()
    .replace(/\/$/, "");
}

export function isProtectedDeliveryEnabled() {
  return (
    readPublicEnv("NEXT_PUBLIC_ENABLE_PROTECTED_DELIVERY", "VITE_ENABLE_PROTECTED_DELIVERY") ===
    "true"
  );
}

export function getGoogleMapsBrowserKey() {
  return readPublicEnv("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY", "VITE_GOOGLE_MAPS_BROWSER_KEY");
}

export function getPublicRazorpayMode() {
  return readPublicEnv("NEXT_PUBLIC_RAZORPAY_MODE", "VITE_RAZORPAY_MODE");
}

export function getRazorpayKeyId(serverSelectedKeyId?: string) {
  const mode = (getPublicRazorpayMode() ?? "").trim().toLowerCase();
  const explicitKey =
    mode === "test"
      ? readPublicEnv("NEXT_PUBLIC_RAZORPAY_TEST_KEY_ID", "VITE_RAZORPAY_TEST_KEY_ID")
      : readPublicEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "VITE_RAZORPAY_KEY_ID");
  const activeKey = (explicitKey ?? serverSelectedKeyId ?? "").trim();
  if (!activeKey) return "";
  if (mode === "test" && !activeKey.startsWith("rzp_test")) {
    throw new Error("Razorpay mode/key mismatch: test mode requires an rzp_test key.");
  }
  if ((mode === "live" || mode === "") && !activeKey.startsWith("rzp_live") && !serverSelectedKeyId) {
    throw new Error("Razorpay mode/key mismatch: live mode requires an rzp_live key.");
  }
  return activeKey;
}

export function getFirebaseClientConfig() {
  return {
    apiKey:
      readPublicEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "VITE_FIREBASE_API_KEY") ??
      "AIzaSyBig88ltbM-GVXbEidCeQlnDl_Vc3pvAYI",
    authDomain:
      readPublicEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_AUTH_DOMAIN") ??
      "bookverse-a0024.firebaseapp.com",
    projectId:
      readPublicEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID") ??
      "bookverse-a0024",
    storageBucket:
      readPublicEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "VITE_FIREBASE_STORAGE_BUCKET") ??
      "bookverse-a0024.firebasestorage.app",
    messagingSenderId:
      readPublicEnv(
        "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
        "VITE_FIREBASE_MESSAGING_SENDER_ID",
      ) ?? "516406961987",
    appId:
      readPublicEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "VITE_FIREBASE_APP_ID") ??
      "1:516406961987:web:6b9b0d97dd6eb5836c71f6",
  };
}
