export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/admin.server";
import { awardShareRewardPoints } from "@/lib/rewards.server";

const Body = z.object({
  listingId: z.string().min(1),
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
    const result = await awardShareRewardPoints({
      uid: decoded.uid,
      listingId: parsed.data.listingId,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save share reward." },
      { status: 500 },
    );
  }
}
