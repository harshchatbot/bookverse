"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { MarketingPageShell } from "@/components/PageShell";
import { PageSpinner } from "@/components/Spinner";
import { appPaths, useAppRouter } from "@/lib/navigation";

const V1_MESSAGE = "Orders and shipping are coming later. BookVerse V1 is WhatsApp-based.";

export function V1Redirect({
  title = "Redirecting to browse",
  message = V1_MESSAGE,
  target = appPaths.browse,
}: {
  title?: string;
  message?: string;
  target?: string;
}) {
  const router = useAppRouter();

  useEffect(() => {
    toast(message);
    router.replace(target);
  }, [message, router, target]);

  return (
    <MarketingPageShell>
      <main className="flex-1">
        <PageSpinner label={title} />
      </main>
    </MarketingPageShell>
  );
}
