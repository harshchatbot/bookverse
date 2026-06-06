export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkServiceability } from "@/lib/shiprocket.server";

const Body = z.object({
  pickupPincode: z.string().regex(/^\d{6}$/, "Invalid pincode"),
  deliveryPincode: z.string().regex(/^\d{6}$/, "Invalid pincode"),
  declaredValue: z.number().int().positive().max(200000),
  weightKg: z.number().positive().max(10).optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    const result = await checkServiceability({
      pickupPincode: parsed.data.pickupPincode,
      deliveryPincode: parsed.data.deliveryPincode,
      declaredValue: parsed.data.declaredValue,
      weightKg: parsed.data.weightKg ?? 0.5,
    });
    if (!result.available) {
      return NextResponse.json(
        { error: "No couriers available for this route" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        rate: result.rate,
        courierId: result.courierId,
        courierName: result.courierName,
        etd: result.etd,
      },
      { status: 200 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Shipping check failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
