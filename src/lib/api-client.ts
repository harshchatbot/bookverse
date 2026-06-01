// Tiny client helper that attaches the Firebase ID token automatically.
import { auth } from "@/integrations/firebase/client";

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.auth !== false) {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  const res = await fetch(path, { ...init, headers });
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
