export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/admin.server";

const Body = z.object({
  name: z.string().trim().min(1),
  phone: z.string().regex(/^\+91[6-9]\d{9}$/),
  email: z.string().trim().email(),
  houseOrFlat: z.string().trim().min(1),
  buildingOrSociety: z.string().trim().default(""),
  streetOrRoad: z.string().trim().default(""),
  areaOrLocality: z.string().trim().min(1),
  address1: z.string().trim().min(1),
  address2: z.string().trim().default(""),
  landmark: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  pincode: z.string().regex(/^\d{6}$/),
  country: z.string().trim().default("India"),
  placeId: z.string().trim().default(""),
  formattedAddress: z.string().trim().default(""),
  lat: z.number().finite(),
  lon: z.number().finite(),
  buyerConfirmed: z.literal(true),
});

const JUNK_ADDRESS_HINTS = new Set(["test", "home", "near bus stand", "ana sagar lake"]);
const WEAK_TOKENS = new Set(["test", "home", "near", "abc"]);

function structuredScore(data: z.infer<typeof Body>) {
  return (
    (data.houseOrFlat.trim().length >= 3 ? 30 : 0) +
    (data.areaOrLocality.trim().length >= 3 ? 20 : 0) +
    (data.landmark.trim().length >= 3 ? 15 : 0) +
    (data.buildingOrSociety.trim().length >= 3 ? 10 : 0) +
    (data.streetOrRoad.trim().length >= 3 ? 10 : 0) +
    15
  );
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
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
      { error: parsed.error.issues[0]?.message ?? "Invalid delivery address" },
      { status: 422 },
    );
  }

  if (
    WEAK_TOKENS.has(parsed.data.houseOrFlat.trim().toLowerCase()) ||
    JUNK_ADDRESS_HINTS.has(parsed.data.areaOrLocality.trim().toLowerCase()) ||
    !parsed.data.houseOrFlat.trim() ||
    !parsed.data.landmark.trim()
  ) {
    return NextResponse.json(
      { error: "Delivery address needs a real courier-ready street address." },
      { status: 422 },
    );
  }

  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Google Address Validation is not configured." },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(
      `https://addressvalidation.googleapis.com/v1:validateAddress?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: {
            regionCode: "IN",
            languageCode: "en",
            addressLines: [
              parsed.data.houseOrFlat,
              parsed.data.buildingOrSociety,
              parsed.data.streetOrRoad,
              parsed.data.areaOrLocality,
              parsed.data.address1,
              parsed.data.address2,
              parsed.data.landmark,
            ].filter(Boolean),
            locality: parsed.data.city,
            administrativeArea: parsed.data.state,
            postalCode: parsed.data.pincode,
          },
        }),
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Google Address Validation is unavailable right now." },
        { status: 503 },
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const result =
      payload.result && typeof payload.result === "object"
        ? (payload.result as Record<string, unknown>)
        : {};
    const verdict =
      result.verdict && typeof result.verdict === "object"
        ? (result.verdict as Record<string, unknown>)
        : {};
    const address =
      result.address && typeof result.address === "object"
        ? (result.address as Record<string, unknown>)
        : {};
    const geocode =
      result.geocode && typeof result.geocode === "object"
        ? (result.geocode as Record<string, unknown>)
        : {};
    const location =
      geocode.location && typeof geocode.location === "object"
        ? (geocode.location as Record<string, unknown>)
        : {};

    const addressComplete = verdict.addressComplete === true;
    const validationGranularity =
      typeof verdict.validationGranularity === "string" ? verdict.validationGranularity : null;
    const geocodeGranularity =
      typeof verdict.geocodeGranularity === "string" ? verdict.geocodeGranularity : null;
    const isGoogleValidated =
      addressComplete &&
      ["PREMISE", "SUB_PREMISE", "PREMISE_PROXIMITY", "ROUTE"].includes(
        validationGranularity ?? "",
      ) &&
      ["PREMISE", "SUB_PREMISE", "ROUTE"].includes(geocodeGranularity ?? "");
    const isGeoConfirmed =
      !isGoogleValidated &&
      !!(
        ((typeof geocode.placeId === "string" && geocode.placeId) || parsed.data.placeId) &&
        (typeof location.latitude === "number" || typeof parsed.data.lat === "number") &&
        (typeof location.longitude === "number" || typeof parsed.data.lon === "number") &&
        ((typeof address.formattedAddress === "string" && address.formattedAddress) ||
          parsed.data.formattedAddress) &&
        structuredScore(parsed.data) >= 80
      );
    const isDeliveryReady = isGoogleValidated || isGeoConfirmed;
    const reasonCodes = [
      ...(Array.isArray(address.missingComponentTypes) ? address.missingComponentTypes : []),
      ...(Array.isArray(address.unconfirmedComponentTypes)
        ? address.unconfirmedComponentTypes
        : []),
      ...(Array.isArray(address.unresolvedTokens) ? address.unresolvedTokens : []),
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (isGeoConfirmed) {
      reasonCodes.push(
        "GOOGLE_ADDRESS_INCOMPLETE_BUT_PIN_CONFIRMED",
        "STRUCTURED_ADDRESS_COMPLETE",
        "MAP_PIN_CONFIRMED",
      );
    }

    return NextResponse.json(
      {
        ok: true,
        isDeliveryReady,
        validationLevel: isGoogleValidated
          ? "google_validated"
          : isGeoConfirmed
            ? "google_geo_confirmed"
            : "needs_more_detail",
        formattedAddress:
          (typeof address.formattedAddress === "string" && address.formattedAddress) ||
          parsed.data.formattedAddress ||
          null,
        lat: typeof location.latitude === "number" ? location.latitude : parsed.data.lat ?? null,
        lon: typeof location.longitude === "number" ? location.longitude : parsed.data.lon ?? null,
        placeId:
          (typeof geocode.placeId === "string" && geocode.placeId) || parsed.data.placeId || null,
        reasonCodes,
        message: isGoogleValidated
          ? "Delivery address is Google-validated and ready for courier delivery."
          : isGeoConfirmed
            ? "Google could not fully verify the house number, but your map pin and delivery details look complete. We will use this buyer-confirmed delivery location for courier delivery."
            : "Google needs a more exact delivery address before protected delivery can continue.",
        googleVerdict: {
          addressComplete,
          validationGranularity,
          geocodeGranularity,
        },
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Google Address Validation is unavailable right now." },
      { status: 503 },
    );
  }
}
