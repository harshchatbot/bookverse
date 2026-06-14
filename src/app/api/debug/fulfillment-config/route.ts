import { NextResponse } from "next/server";

export const runtime = "nodejs";

function isDebugLookupEnabled() {
  return process.env.ENABLE_DEBUG_ORDER_LOOKUP === "true";
}

export async function GET() {
  if (!isDebugLookupEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  console.info("[debug/fulfillment-config] checked");

  return NextResponse.json({
    razorpayMode: process.env.RAZORPAY_MODE || null,
    shiprocketMode: process.env.SHIPROCKET_MODE || null,
    shiprocketEnabled: process.env.SHIPROCKET_ENABLED === "true",
    shiprocketAutoCreateAfterPayment:
      process.env.SHIPROCKET_AUTO_CREATE_AFTER_PAYMENT === "true",
    shiprocketAllowLiveOrderCreation:
      process.env.SHIPROCKET_ALLOW_LIVE_ORDER_CREATION === "true",
    enableLiveShiprocketForTestPayments:
      process.env.ENABLE_LIVE_SHIPROCKET_FOR_TEST_PAYMENTS === "true",
    hasDefaultPickupFallback:
      process.env.ENABLE_SHIPROCKET_DEFAULT_PICKUP_FALLBACK === "true",
    fulfillmentMode: process.env.SHIPROCKET_FULFILLMENT_MODE || "manual",
    hasShiprocketEmail: Boolean(process.env.SHIPROCKET_EMAIL),
    hasShiprocketPassword: Boolean(process.env.SHIPROCKET_PASSWORD),
    defaultPickupLocation: process.env.SHIPROCKET_DEFAULT_PICKUP_LOCATION || null,
    vercelEnv: process.env.VERCEL_ENV || null,
  });
}
