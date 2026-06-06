export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getRewardsSummaryForUser } from "@/lib/rewards.server";
import { requireAuth } from "@/lib/admin.server";

export async function GET(request: NextRequest) {
  let decoded;
  try {
    decoded = await requireAuth(request);
  } catch (response) {
    return response as Response;
  }

  try {
    const summary = await getRewardsSummaryForUser(decoded.uid);
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load rewards summary." },
      { status: 500 },
    );
  }
}
