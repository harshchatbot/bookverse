import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { MarketingPageShell } from "@/components/PageShell";
import { PageSpinner } from "@/components/Spinner";

const V1_MESSAGE = "Orders and shipping are coming later. BookVerse V1 is WhatsApp-based.";

export function V1Redirect({
  title = "Redirecting to browse",
  message = V1_MESSAGE,
}: {
  title?: string;
  message?: string;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    toast(message);
    void navigate({ to: "/browse", replace: true });
  }, [message, navigate]);

  return (
    <MarketingPageShell>
      <main className="flex-1">
        <PageSpinner label={title} />
      </main>
    </MarketingPageShell>
  );
}
