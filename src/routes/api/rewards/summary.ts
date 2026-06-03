import { createFileRoute } from "@tanstack/react-router";
import { getRewardsSummaryForUser } from "@/lib/rewards.server";
import { jsonError, jsonOk, requireAuth } from "@/lib/admin.server";

export const Route = createFileRoute("/api/rewards/summary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        let decoded;
        try {
          decoded = await requireAuth(request);
        } catch (response) {
          return response as Response;
        }

        try {
          const summary = await getRewardsSummaryForUser(decoded.uid);
          return jsonOk(summary);
        } catch (error) {
          return jsonError(
            500,
            error instanceof Error ? error.message : "Could not load rewards summary.",
          );
        }
      },
    },
  },
});
