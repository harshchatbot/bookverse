// Server-only Firebase Admin access. Never import Firebase Admin at module scope:
// Vercel/Nitro may otherwise bundle google-gax as ESM and crash on __dirname.
import { createRemoteJWKSet, jwtVerify } from "jose";

type AdminApp = unknown;
type JsonMap = Record<string, unknown>;

interface DocumentSnapshot {
  id: string;
  exists: boolean;
  data(): JsonMap | undefined;
}

interface QueryDocumentSnapshot extends DocumentSnapshot {
  id: string;
  ref: DocumentReference;
  data(): JsonMap;
}

interface QuerySnapshot {
  empty: boolean;
  size: number;
  docs: QueryDocumentSnapshot[];
}

interface DocumentReference {
  id: string;
  get(): Promise<DocumentSnapshot>;
  set(data: JsonMap, options?: JsonMap): Promise<unknown>;
  update(data: JsonMap): Promise<unknown>;
  delete(): Promise<unknown>;
}

interface QueryReference {
  where(fieldPath: string, opStr: string, value: unknown): QueryReference;
  limit(limit: number): QueryReference;
  get(): Promise<QuerySnapshot>;
}

interface CollectionReference extends QueryReference {
  doc(documentPath?: string): DocumentReference;
  add(data: JsonMap): Promise<DocumentReference>;
}

interface Transaction {
  get(ref: DocumentReference): Promise<DocumentSnapshot>;
  update(ref: DocumentReference, data: JsonMap): unknown;
  set(ref: DocumentReference, data: JsonMap, options?: JsonMap): unknown;
  delete(ref: DocumentReference): unknown;
}

export interface AdminFirestore {
  collection(collectionPath: string): CollectionReference;
  runTransaction(
    updateFunction: (transaction: Transaction) => Promise<unknown> | unknown,
  ): Promise<unknown>;
}

interface AdminAuth {
  verifyIdToken(
    token: string,
  ): Promise<{ uid: string; email?: string | null; [key: string]: unknown }>;
}

interface AdminAppModule {
  initializeApp(options: { credential: unknown; projectId: string }): AdminApp;
  getApps(): AdminApp[];
  cert(serviceAccountPathOrObject: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  }): unknown;
}

interface AdminFirestoreModule {
  getFirestore(app: AdminApp): AdminFirestore;
  FieldValue: {
    serverTimestamp(): unknown;
    arrayUnion(...elements: unknown[]): unknown;
    increment(amount: number): unknown;
  };
  Timestamp: unknown;
}

interface AdminAuthModule {
  getAuth(app: AdminApp): AdminAuth;
}

let appPromise: Promise<AdminApp> | undefined;
let firestoreModulePromise: Promise<AdminFirestoreModule> | undefined;
let authModulePromise: Promise<AdminAuthModule> | undefined;

async function loadAppModule(): Promise<AdminAppModule> {
  return (await import("firebase-admin/app")) as AdminAppModule;
}

async function loadFirestoreModule(): Promise<AdminFirestoreModule> {
  firestoreModulePromise ??= import("firebase-admin/firestore") as Promise<AdminFirestoreModule>;
  return firestoreModulePromise;
}

async function loadAuthModule(): Promise<AdminAuthModule> {
  authModulePromise ??= import("firebase-admin/auth") as Promise<AdminAuthModule>;
  return authModulePromise;
}

async function init(): Promise<AdminApp> {
  if (appPromise) return appPromise;
  appPromise = (async () => {
    // Prefer REST to avoid gRPC issues in serverless. Safe on Node runtimes.
    if (!process.env.FIRESTORE_PREFER_REST) {
      process.env.FIRESTORE_PREFER_REST = "true";
    }
    const { initializeApp, getApps, cert } = await loadAppModule();
    if (getApps().length) return getApps()[0]!;
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    let parsed: { project_id: string; client_email: string; private_key: string } | null = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
      }
    } else {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
      if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
          "FIREBASE_SERVICE_ACCOUNT_JSON is not set. Add the service account JSON in Lovable Cloud secrets.",
        );
      }
      parsed = {
        project_id: projectId,
        client_email: clientEmail,
        private_key: privateKey,
      };
    }
    if (!parsed) {
      throw new Error("Firebase Admin credentials could not be resolved.");
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
  })();
  return appPromise;
}

export async function adminDb(): Promise<AdminFirestore> {
  const [app, firestore] = await Promise.all([init(), loadFirestoreModule()]);
  return firestore.getFirestore(app);
}

export async function adminAuth(): Promise<AdminAuth> {
  const [app, auth] = await Promise.all([init(), loadAuthModule()]);
  return auth.getAuth(app);
}

export async function adminKit() {
  const [db, firestore] = await Promise.all([adminDb(), loadFirestoreModule()]);
  return { db, FieldValue: firestore.FieldValue, Timestamp: firestore.Timestamp };
}

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
    const JWKS = createRemoteJWKSet(
      new URL(
        "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
      ),
    );
    const projectId =
      process.env.FIREBASE_PROJECT_ID ??
      (() => {
        try {
          return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "{}").project_id;
        } catch {
          return "";
        }
      })();
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    return {
      uid: payload.sub as string,
      email: payload.email as string | undefined,
      ...payload,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Response(JSON.stringify({ error: "Invalid token", debug: msg }), {
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
