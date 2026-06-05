import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { adminKit, requireAuth, jsonError, jsonOk } from "@/lib/admin.server";
import { estimateGatewayFee, razorpay, razorpayKeyId } from "@/lib/razorpay.server";
import {
  estimateListingWeightKg,
  estimateParcelDimensions,
  getProtectedDeliveryBuyerTotal,
  getOrderItemsSubtotal,
  getShippingCouponDiscount,
  getOrderTotalWeight,
  normalizeListingIds,
  PROTECTED_DELIVERY_MAX_ITEMS_PER_SELLER,
} from "@/lib/protected-delivery";
import {
  FREE_DELIVERY_REWARD_CODE,
  PLATFORM_SUPPORT_FEE_INR,
  type UserCouponRecord,
} from "@/lib/rewards";
import { getCouponsByIds } from "@/lib/rewards.server";
import { checkServiceability } from "@/lib/shiprocket.server";
import type { Listing, OrderItemSnapshot, PickupAddressSnapshot } from "@/lib/types";

const AddressSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().regex(/^\+91[6-9]\d{9}$/),
  email: z.string().trim().email().max(255),
  houseOrFlat: z.string().trim().min(1).max(120),
  buildingOrSociety: z.string().trim().max(120).default(""),
  streetOrRoad: z.string().trim().max(120).default(""),
  areaOrLocality: z.string().trim().min(1).max(120),
  landmark: z.string().trim().min(1).max(120),
  address1: z.string().trim().min(3).max(200),
  address2: z.string().trim().max(200).default(""),
  city: z.string().trim().min(1).max(60),
  state: z.string().trim().min(1).max(60),
  pincode: z.string().regex(/^\d{6}$/),
  country: z.string().default("India"),
  formattedAddress: z.string().trim().min(1).max(300),
  placeId: z.string().trim().min(1).max(255),
  lat: z.number().finite(),
  lon: z.number().finite(),
  buyerConfirmed: z.literal(true),
  isDeliveryReady: z.literal(true),
  validationLevel: z.enum(["google_validated", "google_geo_confirmed"]),
  googleValidation: z
    .object({
      addressComplete: z.boolean().optional(),
      validationGranularity: z.string().nullable().optional(),
      geocodeGranularity: z.string().nullable().optional(),
      reasonCodes: z.array(z.string()).optional(),
      message: z.string().optional(),
    })
    .nullable()
    .optional(),
});

const Body = z.object({
  listingIds: z.array(z.string().min(1).max(100)).min(1).max(50),
  buyerDeliveryAddress: AddressSchema,
  selectedFulfillmentMode: z.literal("protected_delivery"),
  couponSelections: z
    .array(
      z.object({
        sellerUid: z.string().min(1),
        couponId: z.string().min(1),
      }),
    )
    .max(10)
    .optional(),
});

type AdminListing = Omit<Listing, "id" | "createdAt" | "updatedAt"> & {
  createdAt?: unknown;
  updatedAt?: unknown;
  sellerEmail?: string;
};

function isCompletePickupAddress(value: unknown): value is PickupAddressSnapshot {
  if (!value || typeof value !== "object") return false;
  const pickup = value as Record<string, unknown>;
  const phone = typeof pickup.phone === "string" ? pickup.phone.trim() : "";
  const email = typeof pickup.email === "string" ? pickup.email.trim() : "";
  const houseOrFlat = typeof pickup.houseOrFlat === "string" ? pickup.houseOrFlat.trim() : "";
  const areaOrLocality =
    typeof pickup.areaOrLocality === "string" ? pickup.areaOrLocality.trim() : "";
  const landmark = typeof pickup.landmark === "string" ? pickup.landmark.trim() : "";
  const addressLine1 =
    typeof pickup.address1 === "string"
      ? pickup.address1.trim()
      : typeof pickup.address === "string"
        ? pickup.address.trim()
        : "";
  return (
    typeof (pickup.pickupLocationName ?? pickup.location) === "string" &&
    String(pickup.pickupLocationName ?? pickup.location).trim().length > 0 &&
    typeof pickup.name === "string" &&
    pickup.name.trim().length > 0 &&
    ((/^[6-9]\d{9}$/.test(phone) || /^\+91[6-9]\d{9}$/.test(phone))) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    ((houseOrFlat.length >= 3 && areaOrLocality.length >= 2 && landmark.length >= 2) ||
      addressLine1.length >= 3) &&
    typeof pickup.city === "string" &&
    pickup.city.trim().length > 0 &&
    typeof pickup.state === "string" &&
    pickup.state.trim().length > 0 &&
    typeof pickup.pincode === "string" &&
    /^\d{6}$/.test(pickup.pincode)
  );
}

function isValidatedPickupAddress(value: unknown): value is PickupAddressSnapshot {
  if (!isCompletePickupAddress(value)) return false;
  const pickup = value as PickupAddressSnapshot;
  return !!(
    pickup.isCourierReady === true &&
    (pickup.validationLevel === "google_validated" ||
      pickup.validationLevel === "google_geo_confirmed") &&
    pickup.sellerConfirmed === true &&
    typeof pickup.formattedAddress === "string" &&
    pickup.formattedAddress.trim().length > 0 &&
    typeof pickup.lat === "number" &&
    Number.isFinite(pickup.lat) &&
    typeof pickup.lon === "number" &&
    Number.isFinite(pickup.lon) &&
    (
      (typeof pickup.houseOrFlat === "string" &&
        pickup.houseOrFlat.trim().length > 0 &&
        typeof pickup.areaOrLocality === "string" &&
        pickup.areaOrLocality.trim().length > 0 &&
        typeof pickup.landmark === "string" &&
        pickup.landmark.trim().length > 0) ||
      (typeof pickup.address1 === "string" && pickup.address1.trim().length > 0)
    )
  );
}

function isValidatedDeliveryAddress(value: unknown): value is z.infer<typeof AddressSchema> {
  if (!value || typeof value !== "object") return false;
  const delivery = value as z.infer<typeof AddressSchema>;
  return !!(
    typeof delivery.name === "string" &&
    delivery.name.trim() &&
    /^\+91[6-9]\d{9}$/.test(delivery.phone) &&
    typeof delivery.email === "string" &&
    delivery.email.includes("@") &&
    typeof delivery.houseOrFlat === "string" &&
    delivery.houseOrFlat.trim() &&
    typeof delivery.areaOrLocality === "string" &&
    delivery.areaOrLocality.trim() &&
    typeof delivery.landmark === "string" &&
    delivery.landmark.trim() &&
    typeof delivery.city === "string" &&
    delivery.city.trim() &&
    typeof delivery.state === "string" &&
    delivery.state.trim() &&
    /^\d{6}$/.test(delivery.pincode) &&
    typeof delivery.formattedAddress === "string" &&
    delivery.formattedAddress.trim() &&
    typeof delivery.placeId === "string" &&
    delivery.placeId.trim() &&
    typeof delivery.lat === "number" &&
    Number.isFinite(delivery.lat) &&
    typeof delivery.lon === "number" &&
    Number.isFinite(delivery.lon) &&
    delivery.buyerConfirmed === true &&
    delivery.isDeliveryReady === true &&
    (delivery.validationLevel === "google_validated" ||
      delivery.validationLevel === "google_geo_confirmed")
  );
}

type PreparedSellerGroup = {
  sellerUid: string;
  sellerEmail: string;
  sellerName: string;
  pickupAddress: PickupAddressSnapshot;
  items: OrderItemSnapshot[];
  subtotal: number;
  totalWeightKg: number;
  shippingFee: number;
  courierId: number;
  courierName: string;
  parcel: ReturnType<typeof estimateParcelDimensions>;
};

export const Route = createFileRoute("/api/checkout/create-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
          return jsonError(400, "Invalid JSON");
        }

        const parsed = Body.safeParse(body);
        if (!parsed.success) {
          return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid input");
        }

        const listingIds = normalizeListingIds(parsed.data.listingIds);
        if (listingIds.length !== parsed.data.listingIds.length) {
          return jsonError(400, "Duplicate listing IDs are not allowed.");
        }
        if (!isValidatedDeliveryAddress(parsed.data.buyerDeliveryAddress)) {
          return jsonError(
            409,
            "Buyer delivery address is not validated yet. Please select address on map and validate it.",
          );
        }
        const couponSelections = parsed.data.couponSelections ?? [];
        const seenCouponIds = new Set<string>();
        const couponSelectionBySeller = new Map<string, string>();
        for (const selection of couponSelections) {
          if (couponSelectionBySeller.has(selection.sellerUid)) {
            return jsonError(400, "Only one coupon can be applied per seller group.");
          }
          if (seenCouponIds.has(selection.couponId)) {
            return jsonError(400, "The same coupon cannot be used across multiple seller groups.");
          }
          seenCouponIds.add(selection.couponId);
          couponSelectionBySeller.set(selection.sellerUid, selection.couponId);
        }

        const { db, FieldValue } = await adminKit();
        const listingSnapshots = await Promise.all(
          listingIds.map((listingId) => db.collection("listings").doc(listingId).get()),
        );

        const missingListingIndex = listingSnapshots.findIndex((snap) => !snap.exists);
        if (missingListingIndex !== -1) {
          return jsonError(404, `Listing not found: ${listingIds[missingListingIndex]}`);
        }

        const listings = listingSnapshots.map((snap) => ({
          id: snap.id,
          ...(snap.data() as AdminListing),
        }));

        for (const listing of listings) {
          if (listing.status !== "approved") {
            return jsonError(409, `"${listing.title}" is not available for protected delivery.`);
          }
          if (listing.deliveryType !== "shipping") {
            return jsonError(409, `"${listing.title}" is not available for protected delivery.`);
          }
          if (listing.sellerUid === decoded.uid) {
            return jsonError(400, "You cannot buy your own listing.");
          }
        }

        const groupedBySeller = new Map<string, typeof listings>();
        for (const listing of listings) {
          const sellerListings = groupedBySeller.get(listing.sellerUid) ?? [];
          sellerListings.push(listing);
          groupedBySeller.set(listing.sellerUid, sellerListings);
        }

        for (const sellerUid of couponSelectionBySeller.keys()) {
          if (!groupedBySeller.has(sellerUid)) {
            return jsonError(400, "Coupon selection does not match the current seller groups.");
          }
        }

        const coupons = await getCouponsByIds(decoded.uid, [...seenCouponIds]);
        const couponById = new Map<string, UserCouponRecord>();
        for (const coupon of coupons) {
          couponById.set(coupon.id, coupon);
        }

        for (const couponId of seenCouponIds) {
          const coupon = couponById.get(couponId);
          if (!coupon) {
            return jsonError(404, "Selected coupon was not found.");
          }
          if (coupon.status !== "unused") {
            return jsonError(409, "Selected coupon is no longer available.");
          }
          if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
            return jsonError(409, "Selected coupon has expired.");
          }
        }

        const preparedGroups: PreparedSellerGroup[] = [];

        for (const [sellerUid, sellerListings] of groupedBySeller.entries()) {
          if (sellerListings.length > PROTECTED_DELIVERY_MAX_ITEMS_PER_SELLER) {
            return jsonError(
              400,
              `You can buy up to ${PROTECTED_DELIVERY_MAX_ITEMS_PER_SELLER} books per seller in one protected delivery order.`,
            );
          }

          const sellerProfileSnap = await db.collection("profiles").doc(sellerUid).get();
          const sellerProfile = sellerProfileSnap.exists ? sellerProfileSnap.data() : null;
          const pickupAddress = sellerProfile?.pickupAddress;

          if (!isValidatedPickupAddress(pickupAddress)) {
            return jsonError(
              409,
              "Seller pickup address is not validated yet. Seller must select address on map and validate it.",
            );
          }

          const items: OrderItemSnapshot[] = sellerListings.map((listing) => ({
            listingId: listing.id,
            sellerUid,
            title: listing.title,
            author: listing.author,
            image: Array.isArray(listing.images) ? (listing.images[0] ?? "") : "",
            category: listing.category,
            condition: listing.condition,
            price: Number(listing.sellingPrice),
            quantity: 1,
            estimatedWeightKg: estimateListingWeightKg(listing),
          }));

          const invalidItem = items.find((item) => !Number.isFinite(item.price) || item.price <= 0);
          if (invalidItem) {
            return jsonError(409, `Invalid price found for "${invalidItem.title}".`);
          }

          const subtotal = getOrderItemsSubtotal(items);
          const totalWeightKg = getOrderTotalWeight(items);
          const serviceability = await checkServiceability({
            pickupPincode: pickupAddress.pincode,
            deliveryPincode: parsed.data.buyerDeliveryAddress.pincode,
            declaredValue: subtotal,
            weightKg: totalWeightKg,
          });

          if (!serviceability.available) {
            return jsonError(
              409,
              `Protected delivery is not available from ${sellerListings[0]?.sellerName || "this seller"} to your pincode right now.`,
            );
          }

          preparedGroups.push({
            sellerUid,
            sellerEmail: String(sellerListings[0]?.sellerEmail ?? ""),
            sellerName: sellerListings[0]?.sellerName ?? "Seller",
            pickupAddress,
            items,
            subtotal,
            totalWeightKg,
            shippingFee: Math.ceil(serviceability.rate),
            courierId: serviceability.courierId,
            courierName: serviceability.courierName,
            parcel: estimateParcelDimensions(items.length),
          });
        }

        const groups = [];

        for (const group of preparedGroups) {
          const couponId = couponSelectionBySeller.get(group.sellerUid) ?? null;
          const coupon = couponId ? (couponById.get(couponId) ?? null) : null;
          const couponDiscount = getShippingCouponDiscount(group.shippingFee, !!coupon);
          const buyerDeliveryPayable = Math.max(0, group.shippingFee - couponDiscount);
          const platformSupportFee = PLATFORM_SUPPORT_FEE_INR;
          const gatewayFee = estimateGatewayFee(
            group.subtotal + buyerDeliveryPayable + platformSupportFee,
          );
          const total = getProtectedDeliveryBuyerTotal({
            subtotal: group.subtotal,
            shippingFee: group.shippingFee,
            couponDiscount,
            platformSupportFee,
          });
          const platformFee = platformSupportFee;
          const sellerAmount = group.subtotal;

          const orderRef = db.collection("orders").doc();
          const receipt = `bv_${orderRef.id.slice(0, 30)}`;

          let rzpOrder;
          try {
            rzpOrder = await razorpay().orders.create({
              amount: Math.round(total * 100),
              currency: "INR",
              receipt,
              notes: {
                buyerUid: decoded.uid,
                sellerUid: group.sellerUid,
                orderId: orderRef.id,
                listingIds: group.items.map((item) => item.listingId).join(","),
                itemCount: String(group.items.length),
              },
            });
          } catch (error) {
            return jsonError(502, error instanceof Error ? error.message : "Razorpay error");
          }

          await orderRef.set({
            buyerUid: decoded.uid,
            buyerEmail: decoded.email ?? parsed.data.buyerDeliveryAddress.email,
            sellerUid: group.sellerUid,
            sellerEmail: group.sellerEmail,
            fulfillmentMode: parsed.data.selectedFulfillmentMode,
            items: group.items,
            itemCount: group.items.length,
            listing: {
              id: group.items[0]?.listingId ?? "",
              title: group.items[0]?.title ?? "Book",
              author: group.items[0]?.author ?? "",
              image: group.items[0]?.image ?? "",
              condition: group.items[0]?.condition ?? "",
              category: group.items[0]?.category ?? "",
              originalPrice: null,
            },
            pickupAddress: group.pickupAddress,
            shippingAddress: parsed.data.buyerDeliveryAddress,
            courierId: group.courierId,
            courierName: group.courierName,
            subtotal: group.subtotal,
            bookPrice: group.subtotal,
            shippingFee: group.shippingFee,
            gatewayFee,
            platformFee,
            platformSupportFee,
            couponId,
            couponCode: coupon ? FREE_DELIVERY_REWARD_CODE : null,
            couponDiscount,
            bookVerseShippingSubsidy: couponDiscount,
            totalAmount: total,
            sellerAmount,
            totalWeightKg: group.totalWeightKg,
            parcelDimensions: group.parcel,
            status: "pending_payment",
            paymentStatus: "pending",
            shipmentStatus: "pending",
            paymentId: null,
            razorpayOrderId: rzpOrder.id,
            shipmentId: null,
            shiprocketOrderId: null,
            shiprocketShipmentId: null,
            awb: null,
            courierAssigned: null,
            trackingUrl: null,
            payoutId: null,
            deliveredAt: null,
            payoutEligibleAt: null,
            cancelledAt: null,
            hasOpenDispute: false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });

          groups.push({
            orderId: orderRef.id,
            sellerUid: group.sellerUid,
            sellerName: group.sellerName,
            listingIds: group.items.map((item) => item.listingId),
            itemCount: group.items.length,
            items: group.items,
            razorpayOrderId: rzpOrder.id,
            amount: Number(rzpOrder.amount),
            currency: rzpOrder.currency,
            key: razorpayKeyId(),
            buyerName: parsed.data.buyerDeliveryAddress.name,
            buyerEmail: parsed.data.buyerDeliveryAddress.email,
            buyerPhone: parsed.data.buyerDeliveryAddress.phone,
            courierName: group.courierName,
            breakdown: {
              subtotal: group.subtotal,
              shippingFee: group.shippingFee,
              gatewayFee,
              platformSupportFee,
              couponDiscount,
              buyerDeliveryPayable,
              bookVerseShippingSubsidy: couponDiscount,
              total,
            },
          });
        }

        return jsonOk({ groups });
      },
    },
  },
});
