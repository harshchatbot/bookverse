export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin.server";
import { runFulfillment } from "@/lib/fulfillment.server";

const Body = z.object({ orderId: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch (r) {
    return r as Response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const result = await runFulfillment(parsed.data.orderId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Fulfillment failed", reachedStep: result.reachedStep },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, reachedStep: result.reachedStep }, { status: 200 });
}
