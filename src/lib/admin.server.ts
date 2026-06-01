// Server-only firebase-admin singleton. Never import from client code.
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Prefer REST to avoid gRPC issues in serverless. Safe on Node runtimes.
if (!process.env.FIRESTORE_PREFER_REST) {
  process.env.FIRESTORE_PREFER_REST = "true";
}

function init(): App {
  if (getApps().length) return getApps()[0]!;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not set. Add the service account JSON in Lovable Cloud secrets.",
    );
  }
  let parsed: { project_id: string; client_email: string; private_key: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  // Normalise \n in private_key when pasted as a single line.
  const privateKey = parsed.private_key.replace(/\\n/g, "\n");
  return initializeApp({
    credential: cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey,
    }),
    projectId: parsed.project_id,
  });
}

export function adminDb() {
  return getFirestore(init());
}

export function adminAuth() {
  return getAuth(init());
}

export { FieldValue, Timestamp };

const ADMIN_EMAILS = ["harshveernirwan@gmail.com"];

export async function verifyIdToken(authHeader: string | null | undefined) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ error: "Missing bearer token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const token = authHeader.slice("Bearer ".length).trim();
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return decoded;
  } catch {
    throw new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function requireAuth(request: Request) {
  const decoded = await verifyIdToken(request.headers.get("authorization"));
  return decoded;
}

export async function requireAdmin(request: Request) {
  const decoded = await verifyIdToken(request.headers.get("authorization"));
  const email = (decoded.email ?? "").toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    throw new Response(JSON.stringify({ error: "Admin only" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return decoded;
}

export function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error, ...extra }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
