import { createFileRoute } from "@tanstack/react-router";
import { V1Redirect } from "@/components/V1Redirect";

export const Route = createFileRoute("/checkout/$listingId")({
  head: () => ({
    meta: [{ title: "Redirecting — BookVerse" }, { name: "robots", content: "noindex" }],
  }),
  component: CheckoutRedirect,
});

function CheckoutRedirect() {
  return <V1Redirect />;
}
