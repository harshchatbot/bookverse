import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { adminKit, requireAuth, jsonError, jsonOk } from "@/lib/admin.server";
import { estimateGatewayFee, razorpay, razorpayKeyId } from "@/lib/razorpay.server";
import {
  estimateListingWeightKg,
  estimateParcelDimensions,
  getOrderItemsSubtotal,
  getOrderTotalWeight,
  normalizeListingIds,
  PROTECTED_DELIVERY_MAX_ITEMS_PER_SELLER,
} from "@/lib/protected-delivery";
import { checkServiceability } from "@/lib/shiprocket.server";
import type { Listing, OrderItemSnapshot, PickupAddressSnapshot } from "@/lib/types";

const AddressSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().regex(/^[0-9+\-\s()]{10,20}$/),
  email: z.string().trim().email().max(255),
  address1: z.string().trim().min(3).max(200),
  address2: z.string().trim().max(200).default(""),
  city: z.string().trim().min(1).max(60),
  state: z.string().trim().min(1).max(60),
  pincode: z.string().regex(/^\d{6}$/),
  country: z.string().default("India"),
});

const Body = z.object({
  listingIds: z.array(z.string().min(1).max(100)).min(1).max(50),
  buyerDeliveryAddress: AddressSchema,
  selectedFulfillmentMode: z.literal("protected_delivery"),
});

type AdminListing = Omit<Listing, "id" | "createdAt" | "updatedAt"> & {
  createdAt?: unknown;
  updatedAt?: unknown;
  sellerEmail?: string;
};

function isCompletePickupAddress(value: unknown): value is PickupAddressSnapshot {
  if (!value || typeof value !== "object") return false;
  const pickup = value as Record<string, unknown>;
  return (
    typeof pickup.name === "string" &&
    pickup.name.trim().length > 0 &&
    typeof pickup.phone === "string" &&
    pickup.phone.trim().length >= 10 &&
    typeof pickup.address === "string" &&
    pickup.address.trim().length >= 3 &&
    typeof pickup.city === "string" &&
    pickup.city.trim().length > 0 &&
    typeof pickup.state === "string" &&
    pickup.state.trim().length > 0 &&
    typeof pickup.pincode === "string" &&
    /^\d{6}$/.test(pickup.pincode)
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

          if (!isCompletePickupAddress(pickupAddress)) {
            return jsonError(
              409,
              `${sellerListings[0]?.sellerName || "This seller"} has not added a courier pickup address yet.`,
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
          const gatewayFee = estimateGatewayFee(group.subtotal + group.shippingFee);
          const total = group.subtotal + group.shippingFee + gatewayFee;
          const platformFee = 0;
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
              platformFee,
              total,
            },
          });
        }

        return jsonOk({ groups });
      },
    },
  },
});
