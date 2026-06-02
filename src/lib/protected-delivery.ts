import type { CheckoutDeliveryAddress, Listing, OrderItemSnapshot } from "@/lib/types";

export const PROTECTED_DELIVERY_MAX_ITEMS_PER_SELLER = 10;
export const DEFAULT_BOOK_WEIGHT_KG = 0.5;

export function normalizeListingIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const rawId of ids) {
    const id = rawId.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }

  return normalized;
}

export function estimateListingWeightKg(_: Pick<Listing, "category">): number {
  return DEFAULT_BOOK_WEIGHT_KG;
}

export function estimateParcelDimensions(itemCount: number) {
  const safeCount = Math.max(1, Math.min(itemCount, PROTECTED_DELIVERY_MAX_ITEMS_PER_SELLER));
  return {
    lengthCm: 22,
    breadthCm: 16,
    heightCm: Math.min(24, 4 + (safeCount - 1) * 2),
  };
}

export function getOrderItemsSubtotal(items: OrderItemSnapshot[]) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function getOrderTotalWeight(items: OrderItemSnapshot[]) {
  const weight = items.reduce((sum, item) => sum + item.estimatedWeightKg * item.quantity, 0);
  return Number(weight.toFixed(2));
}

export interface CreatedProtectedDeliveryGroup {
  orderId: string;
  sellerUid: string;
  sellerName: string;
  listingIds: string[];
  itemCount: number;
  items: OrderItemSnapshot[];
  razorpayOrderId: string;
  amount: number;
  currency: string;
  key: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  courierName: string;
  breakdown: {
    subtotal: number;
    shippingFee: number;
    gatewayFee: number;
    platformFee: number;
    total: number;
  };
}

export interface CreateProtectedDeliveryOrderInput {
  listingIds: string[];
  buyerDeliveryAddress: CheckoutDeliveryAddress;
  selectedFulfillmentMode: "protected_delivery";
}
