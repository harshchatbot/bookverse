import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { adminDb, FieldValue, requireAdmin, jsonError, jsonOk } from "@/lib/admin.server";
import { createShiprocketOrder } from "@/lib/shiprocket.server";

const Body = z.object({ orderId: z.string().min(1) });

function nowYMDHM(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export const Route = createFileRoute("/api/admin/shipment-retry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAdmin(request);
        } catch (r) {
          return r as Response;
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Invalid JSON");
        }
        const parsed = Body.safeParse(body);
        if (!parsed.success) return jsonError(400, "Invalid input");
        const db = adminDb();
        const orderRef = db.collection("orders").doc(parsed.data.orderId);
        const snap = await orderRef.get();
        if (!snap.exists) return jsonError(404, "Order not found");
        const order = snap.data()!;
        if (order.status !== "paid" && order.status !== "shipment_created") {
          return jsonError(409, `Cannot retry from status ${order.status}`);
        }
        const pickupSnap = await db.collection("profiles").doc(order.sellerUid).get();
        const pickup = pickupSnap.exists ? pickupSnap.data()?.pickupAddress : null;
        if (!pickup) return jsonError(409, "Seller pickup address missing");

        try {
          const sr = await createShiprocketOrder({
            orderId: orderRef.id,
            orderDate: nowYMDHM(),
            pickup,
            buyer: order.shippingAddress,
            item: {
              name: order.listing.title,
              sku: order.listing.id,
              unitsPriceInr: order.bookPrice,
              quantity: 1,
            },
            weightKg: 0.5,
            paymentMethod: "Prepaid",
            subtotalInr: order.bookPrice + order.shippingFee,
          });
          const shipmentRef = db.collection("shipments").doc();
          await shipmentRef.set({
            orderId: orderRef.id,
            shiprocketOrderId: sr.shiprocketOrderId,
            shiprocketShipmentId: sr.shipmentId,
            status: sr.status,
            awb: null,
            courierName: order.courierName ?? null,
            trackingUrl: null,
            history: [{ status: sr.status, at: new Date().toISOString() }],
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          await orderRef.update({
            status: "shipment_created",
            shipmentId: shipmentRef.id,
            shiprocketOrderId: sr.shiprocketOrderId,
            shiprocketShipmentId: sr.shipmentId,
            updatedAt: FieldValue.serverTimestamp(),
          });
          return jsonOk({ ok: true });
        } catch (e) {
          return jsonError(502, e instanceof Error ? e.message : "Shiprocket failed");
        }
      },
    },
  },
});
