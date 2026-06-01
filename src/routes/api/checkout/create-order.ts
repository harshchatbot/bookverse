import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  adminKit,
  requireAuth,
  jsonError,
  jsonOk,
} from "@/lib/admin.server";
import { razorpay, razorpayKeyId, estimateGatewayFee } from "@/lib/razorpay.server";

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
  listingId: z.string().min(1).max(100),
  shippingAddress: AddressSchema,
  shippingFee: z.number().int().min(0).max(5000),
  courierId: z.number().int().positive(),
  courierName: z.string().min(1).max(100),
});

export const Route = createFileRoute("/api/checkout/create-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let decoded;
        try {
          decoded = await requireAuth(request);
        } catch (r) {
          return r as Response;
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

        const { db, FieldValue } = await adminKit();
        const listingSnap = await db.collection("listings").doc(parsed.data.listingId).get();
        if (!listingSnap.exists) return jsonError(404, "Listing not found");
        const listing = listingSnap.data()!;
        if (listing.status !== "approved") {
          return jsonError(409, "Listing is not available for purchase");
        }
        if (listing.sellerUid === decoded.uid) {
          return jsonError(400, "You cannot buy your own listing");
        }

        // Seller pickup address required
        const sellerProfileSnap = await db.collection("profiles").doc(listing.sellerUid).get();
        const sellerProfile = sellerProfileSnap.exists ? sellerProfileSnap.data()! : {};
        const pickup = sellerProfile?.pickupAddress;
        if (!pickup || !pickup.pincode || !pickup.address) {
          return jsonError(409, "Seller has not added a pickup address yet");
        }

        const bookPrice = Number(listing.sellingPrice);
        if (!Number.isFinite(bookPrice) || bookPrice <= 0) {
          return jsonError(409, "Invalid listing price");
        }
        const shippingFee = parsed.data.shippingFee;
        const subtotal = bookPrice + shippingFee;
        const gatewayFee = estimateGatewayFee(subtotal);
        const total = subtotal + gatewayFee;
        const platformFee = 0;
        const sellerAmount = bookPrice;
        const originalPriceRaw = Number(listing.originalPrice);
        const originalPriceSnapshot =
          Number.isFinite(originalPriceRaw) && originalPriceRaw > 0 ? originalPriceRaw : null;

        // Create order doc first (pending_payment) so we can store our orderId on Razorpay receipt.
        const orderRef = db.collection("orders").doc();
        const receipt = `bv_${orderRef.id.slice(0, 30)}`;

        let rzpOrder;
        try {
          rzpOrder = await razorpay().orders.create({
            amount: Math.round(total * 100), // paise
            currency: "INR",
            receipt,
            notes: {
              listingId: parsed.data.listingId,
              buyerUid: decoded.uid,
              sellerUid: String(listing.sellerUid),
              orderId: orderRef.id,
            },
          });
        } catch (e) {
          return jsonError(502, e instanceof Error ? e.message : "Razorpay error");
        }

        await orderRef.set({
          buyerUid: decoded.uid,
          buyerEmail: decoded.email ?? "",
          sellerUid: listing.sellerUid,
          sellerEmail: listing.sellerEmail ?? "",
          listing: {
            id: listingSnap.id,
            title: listing.title,
            author: listing.author,
            image: Array.isArray(listing.images) ? listing.images[0] ?? "" : "",
            condition: listing.condition,
            category: listing.category,
            originalPrice: originalPriceSnapshot,
          },
          shippingAddress: parsed.data.shippingAddress,
          courierId: parsed.data.courierId,
          courierName: parsed.data.courierName,
          bookPrice,
          shippingFee,
          gatewayFee,
          platformFee,
          totalAmount: total,
          sellerAmount,
          status: "pending_payment",
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

        return jsonOk({
          orderId: orderRef.id,
          razorpayOrderId: rzpOrder.id,
          amount: Number(rzpOrder.amount),
          currency: rzpOrder.currency,
          key: razorpayKeyId(),
          buyerName: parsed.data.shippingAddress.name,
          buyerEmail: parsed.data.shippingAddress.email,
          buyerPhone: parsed.data.shippingAddress.phone,
          breakdown: { bookPrice, shippingFee, gatewayFee, platformFee, total },
        });
      },
    },
  },
});
