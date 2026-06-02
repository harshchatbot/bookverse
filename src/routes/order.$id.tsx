import { createFileRoute } from "@tanstack/react-router";
import { V1Redirect } from "@/components/V1Redirect";

export const Route = createFileRoute("/order/$id")({
  head: () => ({
    meta: [{ title: "Redirecting — BookVerse" }, { name: "robots", content: "noindex" }],
  }),
  component: OrderRedirect,
});

function OrderRedirect() {
  return <V1Redirect />;
}
