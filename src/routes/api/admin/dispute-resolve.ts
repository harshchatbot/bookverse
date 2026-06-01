import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { adminKit, requireAdmin, jsonError, jsonOk } from "@/lib/admin.server";

const Body = z.object({
  disputeId: z.string().min(1),
  status: z.enum(["resolved", "refunded"]),
  note: z.string().max(1000).optional(),
});

export const Route = createFileRoute("/api/admin/dispute-resolve")({
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

        const { db, FieldValue } = await adminKit();
        const ref = db.collection("disputes").doc(parsed.data.disputeId);
        const snap = await ref.get();
        if (!snap.exists) return jsonError(404, "Dispute not found");
        const dispute = snap.data()!;

        await ref.update({
          status: parsed.data.status,
          resolutionNote: parsed.data.note ?? null,
          updatedAt: FieldValue.serverTimestamp(),
        });

        if (dispute.orderId) {
          await db.collection("orders").doc(dispute.orderId).update({
            hasOpenDispute: false,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        return jsonOk({ ok: true });
      },
    },
  },
});
