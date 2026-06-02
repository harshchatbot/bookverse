import { createFileRoute } from "@tanstack/react-router";
import { V1Redirect } from "@/components/V1Redirect";

export const Route = createFileRoute("/buyer-dashboard")({
  head: () => ({ meta: [{ title: "Redirecting — BookVerse" }] }),
  component: BuyerDashboardRedirect,
});

function BuyerDashboardRedirect() {
  return <V1Redirect />;
}
