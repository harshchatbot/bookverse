import type { OrderItemSnapshot } from "@/lib/types";
import { summarizeOrderItems } from "@/lib/types";

interface LegacyListingSnapshot {
  id: string;
  title: string;
  author?: string;
  image?: string;
  condition?: string;
  category?: string;
  originalPrice?: number | null;
}

interface OrderLike {
  sellerUid?: string;
  items?: OrderItemSnapshot[];
  listing?: LegacyListingSnapshot | null;
}

export function getStoredOrderItems(order: OrderLike): OrderItemSnapshot[] {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items.filter((item): item is OrderItemSnapshot => !!item?.listingId);
  }

  if (!order.listing?.id) return [];

  return [
    {
      listingId: order.listing.id,
      sellerUid: order.sellerUid ?? "",
      title: order.listing.title ?? "Book",
      author: order.listing.author ?? "",
      image: order.listing.image ?? "",
      category: order.listing.category ?? "",
      condition: order.listing.condition ?? "",
      price: typeof order.listing.originalPrice === "number" ? order.listing.originalPrice : 0,
      quantity: 1,
      estimatedWeightKg: 0.5,
    },
  ];
}

export function getStoredOrderListingIds(order: OrderLike): string[] {
  return getStoredOrderItems(order).map((item) => item.listingId);
}

export function getStoredOrderSummary(order: OrderLike): string {
  return summarizeOrderItems(getStoredOrderItems(order));
}
