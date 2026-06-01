import { Timestamp } from "firebase/firestore";

/**
 * Recursively converts Firebase Timestamp instances (and other non-serializable
 * Firestore values) to plain JSON-safe values so loader data can be serialized
 * by Seroval during SSR.
 *
 * - Timestamp -> ISO string
 * - Arrays / plain objects -> recursed
 * - Primitives -> returned as-is
 */
export function serializeFirestore<T>(value: T): T {
  return serialize(value) as T;
}

function serialize(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  // Some envs return Timestamp-like plain objects (e.g. via toJSON). Detect by shape.
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { seconds?: unknown }).seconds === "number" &&
    typeof (value as { nanoseconds?: unknown }).nanoseconds === "number" &&
    Object.keys(value as object).length === 2
  ) {
    const v = value as { seconds: number; nanoseconds: number };
    return new Date(v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6)).toISOString();
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v);
    }
    return out;
  }
  return value;
}
