import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonError, jsonOk, requireAuth } from "@/lib/admin.server";
import { FREE_DELIVERY_REWARD_CODE } from "@/lib/rewards";
import { redeemFreeDeliveryReward } from "@/lib/rewards.server";

const Body = z.object({
  code: z.literal(FREE_DELIVERY_REWARD_CODE),
});

export const Route = createFileRoute("/api/rewards/redeem")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let decoded;
        try {
          decoded = await requireAuth(request);
        } catch (response) {
          return response as Response;
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Invalid JSON");
        }

        const parsed = Body.safeParse(body);
        if (!parsed.success) {
          return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid input");
        }

        try {
          const summary = await redeemFreeDeliveryReward(decoded.uid);
          return jsonOk(summary);
        } catch (error) {
          return jsonError(
            400,
            error instanceof Error ? error.message : "Could not redeem FREEDEL50.",
          );
        }
      },
    },
  },
});
