// Tiny client helper that attaches the Firebase ID token automatically.
import { onAuthStateChanged, type User } from "firebase/auth";
import { getPublicApiBaseUrl } from "@/lib/env";
import { auth } from "@/integrations/firebase/client";

const apiBaseUrl = getPublicApiBaseUrl();
const migratedApiPaths = new Set([
  "/api/dashboard/order-metrics",
  "/api/rewards/summary",
  "/api/checkout/create-order",
  "/api/address/validate-pickup",
  "/api/address/validate-delivery",
  "/api/address/validate-home",
]);

function resolveApiUrl(path: string) {
  if (apiBaseUrl && migratedApiPaths.has(path)) {
    if (path === "/api/dashboard/order-metrics") {
      return `${apiBaseUrl}/dashboard/order-metrics`;
    }
    if (path === "/api/rewards/summary") {
      return `${apiBaseUrl}/rewards/summary`;
    }
    if (path === "/api/checkout/create-order") {
      return `${apiBaseUrl}/checkout/create-order`;
    }
    if (path === "/api/address/validate-pickup") {
      return `${apiBaseUrl}/address/validate-pickup`;
    }
    if (path === "/api/address/validate-delivery") {
      return `${apiBaseUrl}/address/validate-delivery`;
    }
    if (path === "/api/address/validate-home") {
      return `${apiBaseUrl}/address/validate-home`;
    }
  }

  return path;
}

async function getFirebaseToken(): Promise<string | null> {
  if (auth.currentUser) {
    return auth.currentUser.getIdToken();
  }

  if (typeof auth.authStateReady === "function") {
    await auth.authStateReady();
    return auth.currentUser ? auth.currentUser.getIdToken() : null;
  }

  const user = await new Promise<User | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      unsubscribe();
      resolve(nextUser);
    });
  });

  return user ? user.getIdToken() : null;
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.auth !== false && !headers.has("Authorization")) {
    const token = await getFirebaseToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    } 
  }
  const res = await fetch(resolveApiUrl(path), { ...init, headers });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* keep null */
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    if (json && typeof json === "object" && "error" in json) {
      message = String((json as { error: unknown }).error);
    }
    throw new Error(message);
  }
  return json as T;
}
