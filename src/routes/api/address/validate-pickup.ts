import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonError, jsonOk, requireAuth } from "@/lib/admin.server";

const Body = z.object({
  pickupLocationName: z.string().trim().default(""),
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
  sellerConfirmed: z.literal(true),
});

const JUNK_ADDRESS_HINTS = new Set(["test", "home", "near bus stand", "ana sagar lake"]);
const WEAK_TOKENS = new Set(["test", "home", "near", "abc"]);
const GOOGLE_GEO_CONFIRMED = "google_geo_confirmed";

export const Route = createFileRoute("/api/address/validate-pickup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireAuth(request);
        } catch (response) {
          return response as Response;
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Invalid JSON");
        }

        const parsed = Body.safeParse(body);
        if (!parsed.success) {
          return jsonError(422, parsed.error.issues[0]?.message ?? "Invalid pickup address");
        }

        if (
          WEAK_TOKENS.has(parsed.data.houseOrFlat.trim().toLowerCase()) ||
          JUNK_ADDRESS_HINTS.has(parsed.data.areaOrLocality.trim().toLowerCase()) ||
          JUNK_ADDRESS_HINTS.has(parsed.data.landmark.trim().toLowerCase())
        ) {
          return jsonError(422, "Pickup address needs a real courier-ready street address.");
        }

        const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
        if (!key) {
          return jsonError(503, "Google Address Validation is not configured.");
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
            return jsonError(503, "Google Address Validation is unavailable right now.");
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
            typeof verdict.validationGranularity === "string"
              ? verdict.validationGranularity
              : null;
          const geocodeGranularity =
            typeof verdict.geocodeGranularity === "string" ? verdict.geocodeGranularity : null;
          const isCourierReady =
            addressComplete &&
            ["PREMISE", "SUB_PREMISE", "PREMISE_PROXIMITY", "ROUTE"].includes(
              validationGranularity ?? "",
            ) &&
            ["PREMISE", "SUB_PREMISE", "ROUTE"].includes(geocodeGranularity ?? "");
          const structuredScore =
            (parsed.data.houseOrFlat.trim().length >= 3 ? 30 : 0) +
            (parsed.data.areaOrLocality.trim().length >= 3 ? 20 : 0) +
            (parsed.data.landmark.trim().length >= 3 ? 15 : 0) +
            (parsed.data.buildingOrSociety.trim().length >= 3 ? 10 : 0) +
            (parsed.data.streetOrRoad.trim().length >= 3 ? 10 : 0) +
            15;
          const isGeoConfirmed =
            !isCourierReady &&
            !!(
              ((typeof geocode.placeId === "string" && geocode.placeId) || parsed.data.placeId) &&
              (typeof location.latitude === "number" || typeof parsed.data.lat === "number") &&
              (typeof location.longitude === "number" || typeof parsed.data.lon === "number") &&
              ((typeof address.formattedAddress === "string" && address.formattedAddress) ||
                parsed.data.formattedAddress) &&
              structuredScore >= 80
            );
          const finalReady = isCourierReady || isGeoConfirmed;
          const reasonCodes = [
            ...(Array.isArray(address.missingComponentTypes)
              ? address.missingComponentTypes
              : []),
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

          return jsonOk({
            ok: true,
            isCourierReady: finalReady,
            validationLevel: isCourierReady
              ? "google_validated"
              : isGeoConfirmed
                ? GOOGLE_GEO_CONFIRMED
                : "needs_more_detail",
            formattedAddress:
              (typeof address.formattedAddress === "string" && address.formattedAddress) ||
              parsed.data.formattedAddress ||
              null,
            lat:
              typeof location.latitude === "number" ? location.latitude : parsed.data.lat ?? null,
            lon:
              typeof location.longitude === "number" ? location.longitude : parsed.data.lon ?? null,
            placeId:
              (typeof geocode.placeId === "string" && geocode.placeId) ||
              parsed.data.placeId ||
              null,
            reasonCodes,
            message: isCourierReady
              ? "Pickup address is Google-validated and courier-ready."
              : isGeoConfirmed
                ? "Google could not fully verify the house number, but your map pin and pickup details look complete. We will use this seller-confirmed pickup location for courier collection."
                : "Google needs a more exact pickup address before courier pickup can be enabled.",
            googleVerdict: {
              addressComplete,
              validationGranularity,
              geocodeGranularity,
            },
          });
        } catch {
          return jsonError(503, "Google Address Validation is unavailable right now.");
        }
      },
    },
  },
});
