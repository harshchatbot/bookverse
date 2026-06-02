import { createFileRoute } from "@tanstack/react-router";
import { V1Redirect } from "@/components/V1Redirect";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "Redirecting — BookVerse" }] }),
  component: OrdersRedirect,
});

function OrdersRedirect() {
  return <V1Redirect />;
}
