export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/admin.server";
import { FREE_DELIVERY_REWARD_CODE } from "@/lib/rewards";
import { redeemFreeDeliveryReward } from "@/lib/rewards.server";

const Body = z.object({
  code: z.literal(FREE_DELIVERY_REWARD_CODE),
});

export async function POST(request: NextRequest) {
  let decoded;
  try {
    decoded = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }

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
    const summary = await redeemFreeDeliveryReward(decoded.uid);
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not redeem FREEDEL50." },
      { status: 400 },
    );
  }
}
