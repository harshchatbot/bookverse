import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonError, jsonOk, requireAuth } from "@/lib/admin.server";

const Body = z.object({
  pickupLocationName: z.string().trim().default(""),
  name: z.string().trim().min(1),
  phone: z.string().regex(/^\+91[6-9]\d{9}$/),
  email: z.string().trim().email(),
  address1: z.string().trim().min(15),
  address2: z.string().trim().default(""),
  landmark: z.string().trim().default(""),
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

        if (JUNK_ADDRESS_HINTS.has(parsed.data.address1.trim().toLowerCase())) {
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
          const reasonCodes = [
            ...(Array.isArray(address.missingComponentTypes)
              ? address.missingComponentTypes
              : []),
            ...(Array.isArray(address.unconfirmedComponentTypes)
              ? address.unconfirmedComponentTypes
              : []),
            ...(Array.isArray(address.unresolvedTokens) ? address.unresolvedTokens : []),
          ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

          return jsonOk({
            ok: true,
            isCourierReady,
            validationLevel: isCourierReady ? "google_validated" : "needs_more_detail",
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
