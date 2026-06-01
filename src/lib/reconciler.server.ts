// Daily reconciler: scans Firestore for orders stuck in intermediate
// fulfillment states and safely re-runs the pipeline. Designed to be
// idempotent — `runFulfillment` already skips completed steps, and
// expired pending_payment orders are only failed once.
import { adminDb, FieldValue } from "@/lib/admin.server";
import { runFulfillment } from "@/lib/fulfillment.server";

export interface ReconcileBucketResult {
  scanned: number;
  acted: number;
  errors: Array<{ orderId: string; error: string }>;
}

export interface ReconcileReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  expiredPendingPayment: ReconcileBucketResult;
  paidWithoutShipment: ReconcileBucketResult;
  shipmentWithoutAwb: ReconcileBucketResult;
  pickupWithoutTracking: ReconcileBucketResult;
}

const PENDING_PAYMENT_TTL_MS = 30 * 60 * 1000; // 30 minutes

function empty(): ReconcileBucketResult {
  return { scanned: 0, acted: 0, errors: [] };
}

async function pushError(
  bucket: ReconcileBucketResult,
  orderId: string,
  error: unknown,
) {
  bucket.errors.push({
    orderId,
    error: error instanceof Error ? error.message : String(error),
  });
}

/** Bucket 1: pending_payment orders older than 30 minutes → mark failed. */
async function expirePendingPayments(): Promise<ReconcileBucketResult> {
  const db = adminDb();
  const cutoff = new Date(Date.now() - PENDING_PAYMENT_TTL_MS);
  const result = empty();

  const snap = await db
    .collection("orders")
    .where("status", "==", "pending_payment")
    .where("createdAt", "<=", cutoff)
    .limit(200)
    .get();

  result.scanned = snap.size;

  for (const doc of snap.docs) {
    try {
      // Idempotent: only flip if still pending_payment.
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        if (!fresh.exists) return;
        if (fresh.data()?.status !== "pending_payment") return;
        tx.update(doc.ref, {
          status: "failed",
          failureReason: "Payment not received within 30 minutes",
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      result.acted += 1;
    } catch (e) {
      await pushError(result, doc.id, e);
    }
  }
  return result;
}

/** Bucket 2: paid orders that never created a Shiprocket shipment. */
async function fulfillPaidOrders(): Promise<ReconcileBucketResult> {
  const db = adminDb();
  const result = empty();
  const snap = await db
    .collection("orders")
    .where("status", "==", "paid")
    .limit(100)
    .get();
  result.scanned = snap.size;

  for (const doc of snap.docs) {
    try {
      const res = await runFulfillment(doc.id);
      if (res.ok) result.acted += 1;
      else await pushError(result, doc.id, res.error ?? "fulfillment failed");
    } catch (e) {
      await pushError(result, doc.id, e);
    }
  }
  return result;
}

/** Bucket 3: shipment_created orders without an AWB. */
async function assignMissingAwbs(): Promise<ReconcileBucketResult> {
  const db = adminDb();
  const result = empty();
  const snap = await db
    .collection("orders")
    .where("status", "==", "shipment_created")
    .limit(100)
    .get();

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.awb) continue; // already has AWB
    result.scanned += 1;
    try {
      const res = await runFulfillment(doc.id);
      if (res.ok) result.acted += 1;
      else await pushError(result, doc.id, res.error ?? "awb assignment failed");
    } catch (e) {
      await pushError(result, doc.id, e);
    }
  }
  return result;
}

/** Bucket 4: pickup_scheduled orders missing tracking URL/AWB. */
async function backfillTracking(): Promise<ReconcileBucketResult> {
  const db = adminDb();
  const result = empty();
  const snap = await db
    .collection("orders")
    .where("status", "==", "pickup_scheduled")
    .limit(100)
    .get();

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.awb && data.trackingUrl) continue;
    result.scanned += 1;
    try {
      const res = await runFulfillment(doc.id);
      if (res.ok) result.acted += 1;
      else await pushError(result, doc.id, res.error ?? "tracking backfill failed");
    } catch (e) {
      await pushError(result, doc.id, e);
    }
  }
  return result;
}

export async function runReconciler(): Promise<ReconcileReport> {
  const startedAt = new Date();

  const expiredPendingPayment = await expirePendingPayments();
  const paidWithoutShipment = await fulfillPaidOrders();
  const shipmentWithoutAwb = await assignMissingAwbs();
  const pickupWithoutTracking = await backfillTracking();

  const finishedAt = new Date();
  const report: ReconcileReport = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    expiredPendingPayment,
    paidWithoutShipment,
    shipmentWithoutAwb,
    pickupWithoutTracking,
  };

  // Persist an audit row so we can see history in Firestore.
  try {
    await adminDb()
      .collection("reconcilerRuns")
      .add({
        ...report,
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (e) {
    console.error("[reconciler] failed to write audit log", e);
  }

  return report;
}
