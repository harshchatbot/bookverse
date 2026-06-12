"use client";

import { V1Redirect } from "@/components/V1Redirect";

export default function SellOrdersPage() {
  return <V1Redirect title="Opening your sales" message="Taking you to orders received." target="/seller/orders" />;
}
