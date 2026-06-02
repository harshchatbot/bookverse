import { createFileRoute } from "@tanstack/react-router";
import { V1Redirect } from "@/components/V1Redirect";

export const Route = createFileRoute("/seller-dashboard")({
  head: () => ({ meta: [{ title: "Redirecting — BookVerse" }] }),
  component: SellerDashboardRedirect,
});

function SellerDashboardRedirect() {
  return <V1Redirect />;
}
