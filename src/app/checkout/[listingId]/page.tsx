"use client";

import { useParams } from "next/navigation";
import { V1Redirect } from "@/components/V1Redirect";

export default function CheckoutListingRedirectPage() {
  const params = useParams<{ listingId: string }>();
  const listingId = params.listingId;

  return (
    <V1Redirect
      title="Redirecting to checkout"
      message="Opening the current checkout flow for this book."
      target={listingId ? `/checkout?ids=${encodeURIComponent(listingId)}` : "/browse"}
    />
  );
}
