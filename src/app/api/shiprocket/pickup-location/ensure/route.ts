import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin.server";
import { ensureSellerPickupLocation } from "@/lib/pickup-location.server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let decoded;
  try {
    decoded = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await ensureSellerPickupLocation({ uid: decoded.uid });
    return NextResponse.json(
      {
        status: result.status,
        pickupLocationName: result.pickupLocationName,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create pickup location.";
    const status =
      message.includes("Please complete your Home Address before listing a book")
        ? 409
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
