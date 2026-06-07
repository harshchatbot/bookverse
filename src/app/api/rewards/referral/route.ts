export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/admin.server";
import { applyReferral } from "@/lib/rewards.server";

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

  const { referralCode } = (body as { referralCode?: unknown });
  if (!referralCode || typeof referralCode !== "string" || !referralCode.trim()) {
    return NextResponse.json({ error: "Referral code is required" }, { status: 400 });
  }

  try {
    const result = await applyReferral({
      newUserUid: decoded.uid,
      referralCode: referralCode.trim().toUpperCase(),
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not apply referral." },
      { status: 400 },
    );
  }
}
