import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { adminDb, FieldValue, requireAdmin, jsonError, jsonOk } from "@/lib/admin.server";

const Body = z.object({
  payoutId: z.string().min(1),
  mode: z.string().min(1).max(50),
  reference: z.string().min(1).max(200),
});

export const Route = createFileRoute("/api/admin/payout-paid")({
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
        const payoutRef = db.collection("seller_payouts").doc(parsed.data.payoutId);
        const snap = await payoutRef.get();
        if (!snap.exists) return jsonError(404, "Payout not found");
        const payout = snap.data()!;
        if (payout.status === "paid") return jsonOk({ ok: true });

        const now = new Date().toISOString();
        await payoutRef.update({
          status: "paid",
          mode: parsed.data.mode,
          reference: parsed.data.reference,
          paidAt: now,
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (payout.orderId) {
          await db.collection("orders").doc(payout.orderId).update({
            status: "completed",
            updatedAt: FieldValue.serverTimestamp(),
          });
          await db.collection("notifications").add({
            userUid: payout.sellerUid,
            type: "payout_paid",
            title: "Payout sent",
            body: `₹${payout.amount} has been paid via ${parsed.data.mode}.`,
            link: `/sell-orders`,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        return jsonOk({ ok: true });
      },
    },
  },
});
