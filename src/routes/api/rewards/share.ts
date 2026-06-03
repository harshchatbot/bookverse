import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAuth, jsonError, jsonOk } from "@/lib/admin.server";
import { awardShareRewardPoints } from "@/lib/rewards.server";

const Body = z.object({
  listingId: z.string().min(1),
});

export const Route = createFileRoute("/api/rewards/share")({
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
          const result = await awardShareRewardPoints({
            uid: decoded.uid,
            listingId: parsed.data.listingId,
          });
          return jsonOk({ ok: true, ...result });
        } catch (error) {
          return jsonError(
            500,
            error instanceof Error ? error.message : "Could not save share reward.",
          );
        }
      },
    },
  },
});
