import { createFileRoute } from "@tanstack/react-router";
import { V1Redirect } from "@/components/V1Redirect";

export const Route = createFileRoute("/sell-orders")({
  head: () => ({ meta: [{ title: "Redirecting — BookVerse" }] }),
  component: SellOrdersRedirect,
});

function SellOrdersRedirect() {
  return <V1Redirect />;
}
